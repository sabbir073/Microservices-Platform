import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * One-off: rewrite every non-ISO2 `User.country` to its ISO-3166-1 alpha-2 code.
 *
 * ## Why
 *
 * `User.country` is documented as ISO2 and every consumer treats it as ISO2:
 * `matchesTargeting()` compares it to a list of codes, `audienceWhere()` filters
 * on it, `ad-geo.ts` refuses anything that is not two letters. The admin user
 * editor, however, shipped a free-text box with the placeholder "Bangladesh" —
 * so some accounts hold the display NAME.
 *
 * Those accounts are not broken in any way a user or an admin can see. They are
 * simply, silently, never matched: excluded from every geo-targeted campaign,
 * absent from every country segment, and bucketed as `ZZ` "unknown" in reports
 * that then renormalise without them. That is the worst failure mode there is —
 * a wrong number that looks right.
 *
 * The write sites are fixed (the editor is now the canonical 196-row dropdown;
 * the profile, admin-create and admin-update APIs all resolve to ISO2 or reject)
 * and the read sites are now tolerant. This script cleans the rows that were
 * written before either was true.
 *
 * ## Safety
 *
 * DRY RUN BY DEFAULT. It prints exactly what it would change and writes nothing
 * unless `--apply` is passed. Rows it cannot resolve are listed and left alone —
 * blanking a country it does not recognise would destroy information, and a
 * human should look at those.
 *
 *   Dry run:  npx tsx --tsconfig tsconfig.script.json scripts/normalize-user-country.ts
 *   Apply:    npx tsx --tsconfig tsconfig.script.json scripts/normalize-user-country.ts --apply
 */

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(
    `\n=== User.country → ISO2 ${APPLY ? "(APPLY — writing)" : "(DRY RUN — no writes)"} ===\n`
  );

  const countries = (await prisma.country.findMany({
    select: { iso2: true, iso3: true, name: true },
  })) as unknown as { iso2: string; iso3: string | null; name: string }[];

  // Same index the runtime resolver builds (src/lib/country-codes.ts): every
  // spelling that should map to a code, lowercased.
  const alias = new Map<string, string>();
  for (const c of countries) {
    const code = (c.iso2 ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    alias.set(code.toLowerCase(), code);
    if (c.iso3) alias.set(c.iso3.trim().toLowerCase(), code);
    if (c.name) alias.set(c.name.trim().toLowerCase(), code);
  }
  console.log(`Country table: ${countries.length} rows, ${alias.size} spellings\n`);

  const users = (await prisma.user.findMany({
    where: { country: { not: null } },
    select: { id: true, email: true, country: true },
    orderBy: { createdAt: "asc" },
  })) as unknown as { id: string; email: string; country: string | null }[];

  const alreadyIso2: string[] = [];
  const fixable: { id: string; email: string; from: string; to: string }[] = [];
  const unresolved: { id: string; email: string; from: string }[] = [];

  for (const u of users) {
    const raw = (u.country ?? "").trim();
    if (!raw) continue;
    const upper = raw.toUpperCase();
    const hit = alias.get(raw.toLowerCase());
    // Already a known ISO2 in the right case — nothing to do.
    if (hit && hit === upper && /^[A-Z]{2}$/.test(upper)) {
      alreadyIso2.push(upper);
      continue;
    }
    if (hit) fixable.push({ id: u.id, email: u.email, from: raw, to: hit });
    else unresolved.push({ id: u.id, email: u.email, from: raw });
  }

  const byValue = new Map<string, number>();
  for (const c of alreadyIso2) byValue.set(c, (byValue.get(c) ?? 0) + 1);

  console.log(`${users.length} account(s) have a country set.`);
  console.log(
    `  already ISO2 : ${alreadyIso2.length}` +
      (byValue.size
        ? `  (${[...byValue.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => `${c}=${n}`)
            .join(", ")})`
        : "")
  );
  console.log(`  would change : ${fixable.length}`);
  console.log(`  unresolvable : ${unresolved.length}\n`);

  if (fixable.length) {
    console.log("Changes:");
    for (const f of fixable) {
      console.log(`  ${f.email.padEnd(34)} "${f.from}" → "${f.to}"`);
    }
    console.log("");
  }
  if (unresolved.length) {
    console.log(
      "Left alone (no match in the Country table — decide these by hand):"
    );
    for (const u of unresolved) {
      console.log(`  ${u.email.padEnd(34)} "${u.from}"`);
    }
    console.log("");
  }

  if (!APPLY) {
    console.log(
      fixable.length
        ? `DRY RUN — nothing written. Re-run with --apply to write ${fixable.length} row(s).`
        : "DRY RUN — nothing to change."
    );
    return;
  }

  let written = 0;
  for (const f of fixable) {
    // One row at a time, by id: a bulk updateMany keyed on the old value would
    // also catch a row an admin edited between the read and the write.
    await prisma.user.update({
      where: { id: f.id },
      data: { country: f.to },
    });
    written++;
  }
  console.log(`Applied — ${written} row(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
