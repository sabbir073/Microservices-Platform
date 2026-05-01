// Strips unused imports flagged by eslint @typescript-eslint/no-unused-vars.
// Reads eslint JSON, collects unused symbol names per file, edits each file's
// import statements to drop those names. Removes empty import lines.
//
// Run from repo root:  node scripts/strip-unused-imports.mjs

import fs from "node:fs";
import { execSync } from "node:child_process";

const repo = process.cwd();

console.log("Running eslint to collect unused-var warnings…");
let raw;
try {
  raw = execSync("npx eslint src/ --format json", {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
} catch (err) {
  // eslint exits non-zero when warnings exist; the JSON is still in stdout
  raw = err.stdout?.toString() ?? "";
}

const results = JSON.parse(raw);

// Group unused-var symbol names by file
const byFile = new Map();
for (const r of results) {
  const unused = r.messages.filter(
    (m) => m.ruleId === "@typescript-eslint/no-unused-vars"
  );
  if (!unused.length) continue;
  const names = new Set();
  for (const m of unused) {
    // Message format: 'X' is defined but never used. / 'X' is assigned a value...
    const match = m.message.match(/^['`"]([A-Za-z_$][A-Za-z0-9_$]*)['`"]/);
    if (match) names.add(match[1]);
  }
  if (names.size) byFile.set(r.filePath, names);
}

console.log(`${byFile.size} file(s) have unused vars to strip.`);

let totalRemoved = 0;
let filesChanged = 0;

for (const [file, names] of byFile.entries()) {
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    console.warn(`  skip ${file} (read failed)`);
    continue;
  }

  let changed = false;
  let removedHere = 0;

  // Process import statements line-by-line to keep file structure intact.
  // We handle three patterns:
  //   1) `import { A, B, C } from "..."`           — drop named members
  //   2) `import Default, { A, B } from "..."`     — keep default, edit named
  //   3) `import Default from "..."`                — drop entire line if Default unused
  // We don't touch namespace imports (`import * as x`).
  const lines = src.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Multi-line import: collect until we find a closing brace or `from`
    if (/^\s*import\s/.test(line) && !/from\s+["']/.test(line)) {
      // Multi-line; collect joined
      let joined = line;
      let j = i;
      while (j + 1 < lines.length && !/from\s+["']/.test(joined)) {
        j++;
        joined += "\n" + lines[j];
      }
      const stripped = stripImport(joined, names);
      if (stripped === null) {
        // Drop entire import block
        i = j + 1;
        changed = true;
        removedHere += 1;
        continue;
      }
      if (stripped !== joined) {
        out.push(stripped);
        changed = true;
      } else {
        out.push(joined);
      }
      i = j + 1;
      continue;
    }

    // Single-line import
    if (/^\s*import\s.*from\s+["']/.test(line)) {
      const stripped = stripImport(line, names);
      if (stripped === null) {
        changed = true;
        removedHere += 1;
        i++;
        continue;
      }
      if (stripped !== line) {
        out.push(stripped);
        changed = true;
      } else {
        out.push(line);
      }
      i++;
      continue;
    }

    out.push(line);
    i++;
  }

  if (changed) {
    fs.writeFileSync(file, out.join("\n"), "utf8");
    filesChanged++;
    totalRemoved += removedHere;
    console.log(`  ✓ ${file.replace(repo + "\\", "").replace(repo + "/", "")}`);
  }
}

console.log(`\nDone. ${filesChanged} file(s) modified.`);

// Returns:
//   null  — entire import statement should be dropped
//   string — possibly-edited import statement
function stripImport(stmt, unusedNames) {
  // Match `import [defaultSpec][, { named1, named2, ... }] from "module"[;]`
  // We allow `import type { ... } from ...` and value imports the same.

  const fromRe = /\bfrom\s+(["'][^"']+["'])\s*;?\s*$/m;
  const fromMatch = stmt.match(fromRe);
  if (!fromMatch) return stmt;
  const trailing = fromMatch[0]; // "from \"...\";\n"

  // Strip "import " prefix to get the specifier section
  const startMatch = stmt.match(/^(\s*import\s+(?:type\s+)?)/);
  if (!startMatch) return stmt;
  const prefix = startMatch[1];
  const specPart = stmt.slice(prefix.length, fromMatch.index).trim();

  // Parse default + named
  let defaultName = "";
  let namedSection = "";

  if (specPart.startsWith("{")) {
    namedSection = specPart;
  } else if (specPart.startsWith("*")) {
    return stmt; // namespace, skip
  } else {
    const commaIdx = specPart.indexOf(",");
    if (commaIdx === -1) {
      defaultName = specPart.trim();
    } else {
      defaultName = specPart.slice(0, commaIdx).trim();
      namedSection = specPart.slice(commaIdx + 1).trim();
    }
  }

  let dropDefault = false;
  if (defaultName && unusedNames.has(defaultName)) {
    dropDefault = true;
  }

  let keptNames = [];
  if (namedSection) {
    // Strip braces
    const inner = namedSection.replace(/^\{/, "").replace(/\}$/, "");
    const parts = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      // Possible forms: "A", "A as B", "type A", "type A as B"
      const m = p.match(/^(?:type\s+)?([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?$/);
      if (!m) {
        // Unrecognized — keep verbatim to be safe
        keptNames.push(p);
        continue;
      }
      const localName = m[2] ?? m[1];
      if (unusedNames.has(localName)) continue; // drop
      keptNames.push(p);
    }
  }

  const keepDefault = !dropDefault && defaultName;
  const hasNamed = keptNames.length > 0;

  if (!keepDefault && !hasNamed) {
    return null; // drop entire statement
  }

  const newSpec = keepDefault && hasNamed
    ? `${defaultName}, { ${keptNames.join(", ")} }`
    : keepDefault
      ? defaultName
      : `{ ${keptNames.join(", ")} }`;

  return `${prefix}${newSpec} ${trailing.replace(/^\s*/, "")}`.trimEnd();
}
