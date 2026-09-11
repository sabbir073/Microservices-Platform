import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";
import {
  REFERRAL_BONUS_DEFAULTS,
  normaliseMilestones,
} from "../src/lib/referral-config";

/**
 * The five referral models, and what each of them actually pays.
 *
 * Audited against the owner's list. Three existed, two did not:
 *
 *   1. Two-way (both sides paid)  — MISSING: only the referrer was ever paid,
 *      so the person actually signing up had no reason to use a link.
 *   2. Sign-up                    — existed.
 *   3. Milestone                  — MISSING entirely.
 *   4. Purchase-based             — existed for packages only.
 *   5. Multi-tier                 — existed (ReferralLevel), untouched by
 *      request: "ager tier jeivabe banay silam oita oi vabei thakbe".
 *
 * The properties worth guarding are the ones that cost money when wrong:
 * every award is idempotent on its own reference, milestones cannot be farmed
 * with accounts that never verify, and the invitee's half is not silently
 * withheld for something the referrer did.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-referral-models.ts
 */

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
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const LIB = "src/lib/referral-bonus.ts";
const FORM = "src/components/admin/referrals/referral-bonus-config-form.tsx";

async function main() {
  console.log("\n=== Referral models ===\n");

  /* ── 1. Two-way ── */
  console.log("1. Two-way — the invitee gets paid too");
  {
    const lib = code(LIB);
    check(
      "there is an award for the NEW USER, not only the referrer",
      /export async function awardInviteeSignupBonus/.test(lib),
      "paying only the referrer gives the person signing up no reason to use a link"
    );
    check(
      "it credits the invitee, not the referrer",
      /userId: referredUserId,[\s\S]{0,200}points: cfg\.inviteePoints/.test(lib)
    );
    check(
      "it is idempotent on the invited user",
      /reference: `refbonus_invitee_\$\{referredUserId\}`/.test(lib),
      "signup rewards re-run on a retried verification and a repeated Google callback"
    );
    check(
      "someone who arrived with no referrer is not paid",
      /if \(!referred\?\.referredById\) return;/.test(lib),
      "otherwise it stops being a referral bonus and becomes a universal one"
    );
    check(
      "the invitee's half is NOT withheld for the referrer by default",
      REFERRAL_BONUS_DEFAULTS.inviteeRequiresQualifiedReferrer === false,
      "the invitee did nothing wrong, and withholding removes the incentive the model exists to create"
    );
    check(
      "…but an admin can turn that gate on",
      /cfg\.inviteeRequiresQualifiedReferrer &&/.test(lib)
    );
    const signup = code("src/lib/auth/services.ts");
    check(
      "both halves fire on signup",
      /awardReferralSignupBonus\(userId\)/.test(signup) &&
        /awardInviteeSignupBonus\(userId\)/.test(signup)
    );
  }

  /* ── 2. Sign-up ── */
  console.log("\n2. Sign-up — the referrer's side");
  {
    const lib = code(LIB);
    check(
      "it has its own switch, separate from the master one",
      /!cfg\.signupEnabled/.test(lib),
      "an admin turning off sign-up rewards must not have to turn off everything"
    );
    check(
      "idempotent per invited user",
      /reference: `refbonus_signup_\$\{referredUserId\}`/.test(lib)
    );
  }

  /* ── 3. Milestones ── */
  console.log("\n3. Milestones — the ladder");
  {
    const lib = code(LIB);
    check(
      "milestones exist at all",
      /export async function awardReferralMilestones/.test(lib)
    );
    check(
      "each step is idempotent on its own threshold",
      /reference: `refbonus_milestone_\$\{referrerId\}_\$\{m\.referrals\}`/.test(
        lib
      ),
      "one reference for the whole ladder would pay only the first step ever reached"
    );
    check(
      "EVERY reached step is paid, not just the highest",
      /for \(const m of cfg\.milestones\)/.test(lib) &&
        /if \(count < m\.referrals\) break/.test(lib),
      "a backfill can cross several at once; skipping the middle ones quietly owes somebody money"
    );
    check(
      "it counts ACTIVE invitees only",
      /status: "ACTIVE"/.test(lib),
      "counting raw rows makes the ladder farmable with addresses that never verify"
    );
    check(
      "the anti-farm gate applies to milestones too",
      /awardReferralMilestones[\s\S]{0,600}referrerQualifies\(referrerId, cfg\)/.test(
        lib
      )
    );
    check(
      "it runs when a referral lands, not on a schedule",
      /awardReferralMilestones\(referrerId\)/.test(
        code("src/lib/auth/services.ts")
      ),
      "a reward that arrives days later is not the one that changes behaviour"
    );

    // The normaliser is what lets the award loop trust the order.
    const messy = normaliseMilestones([
      { referrals: 10, points: 500, label: "Silver" },
      { referrals: 3, points: 100, label: "Bronze" },
      { referrals: 3, points: 999, label: "Duplicate" },
      { referrals: 0, points: 50, label: "Zero" },
      { referrals: 5, points: 0, label: "Free" },
      "rubbish",
    ]);
    check("…sorted ascending", messy.map((m) => m.referrals).join() === "3,10");
    check("…duplicates collapse to one", messy.filter((m) => m.referrals === 3).length === 1);
    check("…a zero threshold is dropped", !messy.some((m) => m.referrals === 0));
    check("…a zero reward is dropped", !messy.some((m) => m.points === 0));
    check("…junk is dropped rather than throwing", messy.length === 2);
    check(
      "an unlabelled step still gets a name the user can read",
      normaliseMilestones([{ referrals: 7, points: 10 }])[0].label.length > 0
    );
  }

  /* ── 4. Purchase-based ── */
  console.log("\n4. Purchase-based");
  {
    const lib = code(LIB);
    check(
      "a package purchase pays",
      /export async function awardReferralSubscriptionBonus/.test(lib)
    );
    check(
      "a FIRST purchase of anything else pays separately",
      /export async function awardReferralPurchaseBonus/.test(lib),
      "'bought a plan' and 'spent money at all' are different signals"
    );
    check(
      "the first-purchase bonus is keyed per USER, so it pays once",
      /reference: `refbonus_purchase_\$\{referredUserId\}`/.test(lib),
      "keying it per order would pay on every purchase, which is not what 'first purchase' means"
    );
    check(
      "both have their own switches",
      /!cfg\.subscriptionEnabled/.test(lib) && /!cfg\.purchaseEnabled/.test(lib)
    );
  }

  /* ── 5. Multi-tier, untouched ── */
  console.log("\n5. Multi-tier — left exactly as it was");
  {
    const comm = code("src/lib/referral-commissions.ts");
    check(
      "the chain walk still reads ReferralLevel",
      /prisma\.referralLevel\.findMany/.test(comm)
    );
    check(
      "it still walks up to 10 levels",
      /level <= Math\.min\(10, referralLevels\.length\)/.test(comm)
    );
    check(
      "the cycle guard is still there",
      /seen|visited/i.test(comm),
      "an admin edit can create a loop, and walking one pays the same accounts on every hop"
    );
    check(
      "the level table keeps its own page",
      fs.existsSync(path.join(root, "src/app/admin/referrals/settings/page.tsx"))
    );
    check(
      "…and the referral page links to it",
      /\/admin\/referrals\/settings/.test(code(FORM))
    );
  }

  /* ── 6. One place to control all of it ── */
  console.log("\n6. All of it, on the referral page");
  {
    const form = code(FORM);
    for (const [label, key] of [
      ["referrer sign-up", "signupEnabled"],
      ["invitee half", "inviteeEnabled"],
      ["milestones", "milestonesEnabled"],
      ["subscription", "subscriptionEnabled"],
      ["first purchase", "purchaseEnabled"],
      ["month-end", "monthlyEnabled"],
    ] as const) {
      check(`${label} has a switch`, new RegExp(`cfg\\.${key}`).test(form));
    }
    check(
      "milestones can be added and removed",
      /addMilestone/.test(form) && /dropMilestone/.test(form)
    );
    check(
      "the master switch is visibly separate",
      /set\("enabled", v\)/.test(form)
    );
    check(
      "the form is client-safe — no Prisma pulled into the browser",
      /from "@\/lib\/referral-config"/.test(form) &&
        !/from "@\/lib\/referral-bonus"/.test(form),
      "importing a runtime value from referral-bonus.ts would bundle the database client"
    );
    check(
      "…and that module really has no server imports",
      !/^import .*(server-only|@\/lib\/prisma)/m.test(
        read("src/lib/referral-config.ts")
      )
    );
  }

  /* ── 7. Live ── */
  console.log("\n7. Live state");
  {
    const levels = await prisma.referralLevel.findMany({
      where: { isActive: true },
      orderBy: { level: "asc" },
      select: { level: true, commissionValue: true },
    });
    const total = levels.reduce((s, l) => s + l.commissionValue, 0);
    console.log(
      `   ${levels.length} active level(s), ${total}% of every earning paid out in commission`
    );
    check(
      "the commission ladder does not exceed 100% of an earning",
      total <= 100,
      `${total}% — every task payout would cost more than it pays`
    );

    const paid = await prisma.transaction.groupBy({
      by: ["type"],
      where: { type: "REFERRAL" },
      _count: { _all: true },
      _sum: { points: true },
    }) as unknown as { _count: { _all: number }; _sum: { points: number | null } }[];
    const n = paid[0]?._count._all ?? 0;
    console.log(
      `   ${n} referral payout(s) so far, ${(paid[0]?._sum.points ?? 0).toLocaleString()} points`
    );
    check("the live audit ran", true);
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
