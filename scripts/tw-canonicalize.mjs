// Project-wide Tailwind v4 canonical-class replacement (UTF-8 safe).
// Run with: node scripts/tw-canonicalize.mjs
//
// Replacements:
//   bg-gradient-to-{tr|tl|br|bl|r|l|t|b}  -> bg-linear-to-$1
//   flex-shrink-0                          -> shrink-0
//   break-words                            -> wrap-break-word
//   z-[N]                                  -> z-N
//   max-w-[768px]                          -> max-w-3xl
//   max-w-[Npx] | min-w-[Npx]              -> {prefix}-(N/4)  when N is a multiple of 4

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");

const NAMED_MAX_W_PX = new Map([
  [768, "3xl"],
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      yield full;
    }
  }
}

let touched = 0;
const summary = { gradients: 0, shrink: 0, breakWords: 0, zArbitrary: 0, namedMaxW: 0, pxToScale: 0 };

for (const file of walk(ROOT)) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;

  next = next.replace(/\bbg-gradient-to-(tr|tl|br|bl|r|l|t|b)\b/g, (_m, dir) => {
    summary.gradients++;
    return `bg-linear-to-${dir}`;
  });

  next = next.replace(/\bflex-shrink-0\b/g, () => {
    summary.shrink++;
    return "shrink-0";
  });

  next = next.replace(/\bbreak-words\b/g, () => {
    summary.breakWords++;
    return "wrap-break-word";
  });

  next = next.replace(/\bz-\[(\d+)\]/g, (_m, n) => {
    summary.zArbitrary++;
    return `z-${n}`;
  });

  next = next.replace(/\b(max-w|min-w)-\[(\d+)px\]/g, (m, prefix, n) => {
    const num = parseInt(n, 10);
    if (prefix === "max-w" && NAMED_MAX_W_PX.has(num)) {
      summary.namedMaxW++;
      return `${prefix}-${NAMED_MAX_W_PX.get(num)}`;
    }
    if (num % 4 !== 0) return m;
    summary.pxToScale++;
    return `${prefix}-${num / 4}`;
  });

  if (next !== original) {
    fs.writeFileSync(file, next, "utf8");
    touched++;
  }
}

console.log(`Modified ${touched} files`);
console.log("Replacements:", summary);
