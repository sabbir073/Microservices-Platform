import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";

/**
 * Delete the `SystemSetting` rows left behind by the retired
 * `/admin/settings/[category]` screen (see `verify-settings-truth.ts` §1) that
 * nothing in the codebase reads today:
 *
 *   allow_registration, points_to_usd, support_email, site_description,
 *   dark_mode_default, show_social_feed, show_leaderboard, primary_color
 *
 * They hold values the owner once typed, and two of them sit one rename away
 * from a LIVE key that means the same thing under a different spelling —
 * `points_to_usd` beside `points_per_usd`, `show_leaderboard` beside the live
 * `lb_enabled`. A future key rename that lands on the old spelling would
 * silently inherit whatever value is sitting in the stale row instead of the
 * code's real default. Deleting the row removes that trap; leaving it does
 * not (it merely makes the collision unlikely, not impossible — see the
 * near-miss assertion added to `verify-settings-truth.ts`).
 *
 * SAFETY
 * ------
 * - Dry-run by default: lists what WOULD be deleted and writes nothing.
 * - `--apply` is required to actually delete.
 * - Before deleting anything (dry-run or applied) it freshly re-scans `src/`
 *   for a literal reference to each key and refuses to touch any key it
 *   finds there — this script must never be the thing that deletes a row
 *   something started reading after this list was written.
 *
 * Deleting live rows is the owner's call, not a default part of any other
 * job — this script only lists and, on request, deletes. It does not run
 * itself.
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.script.json scripts/cleanup-stale-settings.ts          # dry run
 *   npx tsx --tsconfig tsconfig.script.json scripts/cleanup-stale-settings.ts --apply  # delete
 */

const STALE_KEYS = [
  "allow_registration",
  "points_to_usd",
  "support_email",
  "site_description",
  "dark_mode_default",
  "show_social_feed",
  "show_leaderboard",
  "primary_color",
] as const;

const root = process.cwd();

function collectSourceFiles(dir: string, acc: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "generated" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectSourceFiles(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
}

function isLiteralKeyIn(blob: string, key: string): boolean {
  return (
    blob.includes(`"${key}"`) ||
    blob.includes(`'${key}'`) ||
    blob.includes(`\`${key}\``)
  );
}

async function main() {
  const apply = process.argv.includes("--apply");

  // Refuse to touch a key this repo actually reads, today — a fresh scan of
  // `src/`, not a hardcoded assumption, so a change elsewhere in the
  // codebase since this list was written can't be deleted out from under it.
  const files: string[] = [];
  collectSourceFiles(path.join(root, "src"), files);
  const blob = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...STALE_KEYS] } },
    select: {
      id: true,
      key: true,
      value: true,
      category: true,
      updatedAt: true,
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  console.log(
    `\n=== Stale settings cleanup (${apply ? "APPLY" : "dry run — nothing will be written"}) ===\n`
  );

  const toDelete: typeof rows = [];
  for (const key of STALE_KEYS) {
    const row = byKey.get(key);
    if (!row) {
      console.log(`  --      ${key}  (no row in the database)`);
      continue;
    }
    if (isLiteralKeyIn(blob, key)) {
      console.log(
        `  SKIP    ${key}  — a literal reference exists in src/. Refusing to delete; investigate before removing this key from STALE_KEYS.`
      );
      continue;
    }
    console.log(
      `  ${apply ? "DELETE " : "WOULD DELETE"}  ${key} = ${JSON.stringify(row.value)}  (category=${row.category ?? "-"}, updated ${row.updatedAt.toISOString().slice(0, 10)})`
    );
    toDelete.push(row);
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to delete.");
  } else if (apply) {
    await prisma.systemSetting.deleteMany({
      where: { id: { in: toDelete.map((r) => r.id) } },
    });
    console.log(`\nDeleted ${toDelete.length} row(s).`);
  } else {
    console.log(
      `\n${toDelete.length} row(s) would be deleted. Re-run with --apply to actually delete them.`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
