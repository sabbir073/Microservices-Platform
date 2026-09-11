import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";

/**
 * Which SystemSetting rows in the LIVE database are keys no source file
 * mentions?
 *
 * `scripts/verify-settings-truth.ts` proves the code and the admin forms agree.
 * This one looks at the other side of the same question: rows that a previous
 * key rename (or a removed feature) left behind. A stale row is harmless until
 * someone renames a key BACK to it, at which point the platform silently picks
 * up a value nobody remembers setting.
 *
 * Read-only. Prints; never deletes.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/audit-settings-rows.ts
 */

const root = process.cwd();

function collect(dir: string, acc: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "generated" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
}

async function main() {
  const files: string[] = [];
  collect(path.join(root, "src"), files);
  collect(path.join(root, "scripts"), files);
  const blob = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const rows = (await prisma.systemSetting.findMany({
    select: { key: true, category: true, updatedAt: true },
  })) as unknown as { key: string; category: string | null; updatedAt: Date }[];

  // Some keys are never written as a literal — `lb_${period}_prize`,
  // `lb_history_${cycleId}` and friends are built at the call site. Treat a row
  // as live when either the whole key or a template-ish prefix of it appears.
  const dynamicPrefixes = [...blob.matchAll(/["'`]([a-z][a-z0-9_]*_)\$\{/g)]
    .map((m) => m[1])
    .concat(
      [...blob.matchAll(/`([a-z][a-z0-9_]*_)\$\{/g)].map((m) => m[1])
    );
  const isDynamic = (key: string) =>
    dynamicPrefixes.some((p) => key.startsWith(p));

  const dead = rows.filter((r) => !blob.includes(r.key) && !isDynamic(r.key));
  console.log(`${rows.length} SystemSetting rows in the database`);
  if (dead.length === 0) {
    console.log("  ok — every row's key appears somewhere in src/ or scripts/");
  } else {
    console.log(`  ${dead.length} row(s) no source file mentions:`);
    for (const d of dead) {
      console.log(
        `    ${d.key}  (category=${d.category ?? "-"}, updated ${d.updatedAt.toISOString().slice(0, 10)})`
      );
    }
  }
  await prisma.$disconnect();
}

void main();
