import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { FEATURE_BUNDLES, missingFor } from "../src/lib/feature-bundles";
import { FEATURE_KEYS, type PackageFeatureKey } from "../src/lib/features";
import { CREATOR_TYPES } from "../src/lib/creator-application";

/**
 * Granting task permission — and everything that has to come with it.
 *
 * The failure this guards against is a grant that looks complete and is not.
 * An admin ticks "Create Tasks" On, the buyer opens the form, picks Social —
 * the type most of them want — and is refused with "Social task creation isn't
 * enabled for your account", because the API gates SOCIAL separately on
 * `socialTasks`. Nothing on the grant screen said so, and the admin is left
 * guessing which of 28 switches is missing.
 *
 * Two more holes in the same shape:
 *  - `/create-task` had NO navigation entry anywhere in the app. The grant
 *    worked and the page was reachable only from a link inside a notification.
 *  - The only application type that granted `createTasks` was AGENCY, which
 *    hands over `agencyMode` + `advertiser` too. Someone who wants 200 people
 *    to follow their page had to be given an agency console to get there.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-buyer-access.ts
 */

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

async function main() {
  console.log("\n=== Buyer access bundle ===\n");

  /* ── 1. The dependency is declared, not folklore ── */
  console.log("1. What createTasks needs is written down");
  {
    const b = FEATURE_BUNDLES.createTasks;
    check("createTasks has a bundle", !!b);
    check(
      "socialTasks is declared REQUIRED, not merely suggested",
      (b?.requires ?? []).some((d) => d.key === "socialTasks"),
      "this is the one that produces a confusing refusal"
    );
    check(
      "targetTasks is a suggestion, not a requirement",
      (b?.suggests ?? []).some((d) => d.key === "targetTasks") &&
        !(b?.requires ?? []).some((d) => d.key === "targetTasks")
    );
    check(
      "every dependency carries a reason",
      [...(b?.requires ?? []), ...(b?.suggests ?? [])].every(
        (d) => d.why.length > 20
      )
    );
    check(
      "the bundle states that withdrawals are NOT granted",
      (b?.doesNotGrant ?? []).some((t) => /withdraw/i.test(t)),
      "funding tasks is not a reason to open a payout channel"
    );
    check(
      "…nor any admin access",
      (b?.doesNotGrant ?? []).some((t) => /admin/i.test(t))
    );
    check(
      "page visibility is flagged as a separate thing to check",
      (b?.alsoNeeds ?? []).some((n) => /create-task/.test(n.label)),
      "an admin can hide the route per user, overriding the grant"
    );

    // Every declared dependency has to be a real feature key.
    const allDeps = Object.values(FEATURE_BUNDLES).flatMap((x) => [
      ...(x?.requires ?? []),
      ...(x?.suggests ?? []),
    ]);
    const bogus = allDeps
      .map((d) => d.key)
      .filter((k) => !FEATURE_KEYS.includes(k));
    check(
      "no bundle names a feature that does not exist",
      bogus.length === 0,
      bogus.join(", ")
    );
  }

  /* ── 2. missingFor reports against the EFFECTIVE grant ── */
  console.log("\n2. Gaps are computed against what the user ends up with");
  {
    const none = (_k: PackageFeatureKey) => false;
    const gapsWithNothing = missingFor("createTasks", none);
    check(
      "with nothing granted, socialTasks is reported missing",
      gapsWithNothing.requires.some((d) => d.key === "socialTasks")
    );

    // A dependency the user's PLAN already supplies is not missing.
    const planHasSocial = (k: PackageFeatureKey) => k === "socialTasks";
    check(
      "a dependency supplied by the package is NOT reported missing",
      missingFor("createTasks", planHasSocial).requires.length === 0,
      "otherwise every grant nags about something already true"
    );

    const all = (_k: PackageFeatureKey) => true;
    check(
      "with everything granted there is nothing to report",
      missingFor("createTasks", all).requires.length === 0 &&
        missingFor("createTasks", all).suggests.length === 0
    );
    check(
      "a feature with no bundle reports no gaps rather than throwing",
      missingFor("lottery", none).requires.length === 0
    );
  }

  /* ── 3. The admin sees it where the decision is made ── */
  console.log("\n3. The grant screen shows the bundle");
  {
    const form = read("src/components/admin/users/edit-user-modal.tsx");
    check("the Feature Access tab imports the bundles", /FEATURE_BUNDLES/.test(form));
    check("…and computes the gaps", /missingFor\(/.test(form));
    check(
      "the gap is computed from override-then-package, not overrides alone",
      /form\.featureOverrides\[k\] \?\? packageFeatures\[k\]/.test(form)
    );
    check(
      "a missing requirement can be granted from that spot",
      /Turn on/.test(form) && /\[d\.key\]: true/.test(form)
    );
    check(
      "the notice only renders when the feature is actually ON",
      /effective\(f\.key\) && bundle/.test(form)
    );
    check(
      "'Does NOT grant' is rendered, not just stored",
      /doesNotGrant/.test(form)
    );
    check(
      "the page hands the form the plan-level values",
      /packageFeatures=\{packageFeatures\}/.test(
        read("src/app/admin/users/[id]/edit/page.tsx")
      )
    );
  }

  /* ── 4. The page a buyer was granted is reachable ── */
  console.log("\n4. /create-task can actually be found");
  {
    const sidebar = read("src/components/dashboard/sidebar.tsx");
    check(
      "there is a nav entry for /create-task",
      /href: "\/create-task"/.test(sidebar),
      "it had none at all — the grant worked and the page was unreachable"
    );
    check(
      "…gated on the feature that grants it",
      /href: "\/create-task"[^}]*feature: "createTasks"/.test(sidebar)
    );
    check(
      "the route is still listed in page-visibility, so it can be hidden per user",
      /"\/create-task"/.test(read("src/lib/page-visibility.ts"))
    );
  }

  /* ── 4b. Running ads is a FEATURE, not an admin role ── */
  console.log("\n4b. Ad Manager is not what its name suggests");
  {
    const rbac = read("src/lib/rbac.ts");
    // The trap: "Ad Manager" reads like "this person can run ads". It is an
    // ADMIN role with ads.manage over EVERY advertiser's campaigns.
    check(
      "AD_MANAGER really is an admin role",
      /ADMIN_ROLES[\s\S]{0,300}"AD_MANAGER"/.test(rbac) &&
        /AD_MANAGER: \[[\s\S]{0,120}"ads\.manage"/.test(rbac),
      "so granting it to a customer hands them everyone else's ad account"
    );
    check(
      "…while running your OWN ads is gated on a feature instead",
      /enabled\.has\("advertiser"\)/.test(
        read("src/app/(main)/advertiser/page.tsx")
      ),
      "two different systems; the safe grant for a buyer is the feature"
    );
    const modal = read("src/components/admin/users/edit-user-modal.tsx");
    check(
      "the role picker warns at the moment of the decision",
      /ROLE_WARNINGS/.test(modal) && /AD_MANAGER:/.test(modal)
    );
    check(
      "…and names the safe alternative rather than only saying no",
      /Feature Access/.test(modal)
    );
    // Whitespace-stripped: the map puts each key on its own line above the
    // string, so a regex spanning the newline is fragile to reformatting.
    const flat = modal.replace(/\s+/g, "");
    const unwarned = [
      "AD_MANAGER",
      "SUPER_ADMIN",
      "FINANCE_ADMIN",
      "AGENCY",
    ].filter((r) => !flat.includes(`${r}:"`));
    check(
      "the most dangerous roles all carry a warning",
      unwarned.length === 0,
      unwarned.join(", ") || undefined
    );
  }

  /* ── 5. A buyer application that is not an agency application ── */
  console.log("\n5. Task Buyer is its own application");
  {
    const meta = CREATOR_TYPES.TASK_BUYER;
    check("TASK_BUYER exists in the catalog", !!meta);
    check(
      "it grants createTasks",
      (meta?.grantFeatures ?? []).includes("createTasks")
    );
    check(
      "it grants socialTasks with it, so the first thing they try works",
      (meta?.grantFeatures ?? []).includes("socialTasks")
    );
    check(
      "it does NOT hand over the agency console",
      !(meta?.grantFeatures ?? []).includes("agencyMode"),
      "AGENCY bundles it; a task buyer never asked for it"
    );
    check(
      "…nor the ad-campaign builder",
      !(meta?.grantFeatures ?? []).includes("advertiser")
    );
    check("it leads to /create-task", meta?.dashboardHref === "/create-task");
    check(
      "its gate is the capability it grants",
      meta?.gateFeature === "createTasks"
    );
    check(
      "AGENCY is unchanged — existing agencies keep everything they had",
      ["agencyMode", "createTasks", "advertiser"].every((k) =>
        CREATOR_TYPES.AGENCY.grantFeatures.includes(k as PackageFeatureKey)
      )
    );

    // The enum value must exist in the live database, or approving one throws.
    const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
      `SELECT unnest(enum_range(NULL::"CreatorApplicationType"))::text AS v`
    );
    const values = rows.map((r) => r.v);
    check(
      "TASK_BUYER is applied to the live database",
      values.includes("TASK_BUYER"),
      `live values: ${values.join(", ")}`
    );
    check(
      "every catalog type exists in the database enum",
      Object.keys(CREATOR_TYPES).every((t) => values.includes(t)),
      Object.keys(CREATOR_TYPES).filter((t) => !values.includes(t)).join(", ")
    );
  }

  /* ── 6. Nobody lost access ── */
  console.log("\n6. Live state");
  {
    // Read every override bag and filter in JS: a JSON-path query for one key
    // is Postgres-specific and this only has to be correct, not fast.
    const rows = await prisma.user.findMany({
      select: { id: true, email: true, featureOverrides: true },
    });
    const bags = rows
      .map((u) => ({
        ...u,
        fo: (u.featureOverrides ?? {}) as Record<string, unknown>,
      }))
      .filter((u) => u.fo.createTasks === true);
    console.log(`   ${bags.length} account(s) hold an explicit createTasks grant`);

    // Not a failure — their PLAN may supply socialTasks. Listed so the owner
    // knows exactly who would hit the confusing refusal if it does not.
    const noSocial = bags.filter((u) => u.fo.socialTasks !== true);
    for (const u of noSocial) console.log(`     - ${u.email}`);
    console.log(
      `   ${noSocial.length} of them have no explicit socialTasks grant`
    );

    // Nobody should have been silently handed a payout channel by a task grant.
    const gotWithdrawals = bags.filter((u) => u.fo.withdrawals === true);
    check(
      "no createTasks grant came bundled with an explicit withdrawals grant",
      gotWithdrawals.length === 0,
      gotWithdrawals.map((u) => u.email).join(", ")
    );
  }

  console.log(
    `\n${failures.length === 0 ? "COMPLETE" : "FAILED"}: ${passed} passed, ${failures.length} failed`
  );
  for (const f of failures) console.log(`  - ${f}`);
  await prisma.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
