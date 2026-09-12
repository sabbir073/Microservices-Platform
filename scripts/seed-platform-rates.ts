import "dotenv/config";
import { prisma } from "./_q";

/**
 * Put a real number behind every rate that was sitting on a code default.
 *
 * The owner asked for the platform to be configured rather than left at zero.
 * These are STARTING POINTS chosen to be defensible, not his decisions — each
 * one is a single control in the admin and the comment beside it says where.
 *
 * Deliberately NOT set here:
 *
 *  - **Staff salaries.** Inventing what somebody is paid would create a real
 *    liability out of a guess. They stay unset, and the payroll screen shows
 *    "not set" rather than "$0.00" so the difference is visible.
 *  - **Staff commission rates.** Same reason: seven bases × a rate each is his
 *    compensation policy, not a default.
 *
 * Dry-run by default. `--apply` writes.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/seed-platform-rates.ts [--apply]
 */

const APPLY = process.argv.includes("--apply");

interface Scalar {
  key: string;
  value: unknown;
  category: string;
  why: string;
  where: string;
}

const SCALARS: Scalar[] = [
  {
    key: "buyer.fee_percent",
    value: 10,
    category: "financial",
    why: "The platform's cut when a buyer funds a task. Was 0, so buyer-funded work earned the platform nothing at all.",
    where: "Settings → Money → Platform fee (%)",
  },
  {
    key: "marketplace.fee_percent",
    value: 5,
    category: "financial",
    why: "Matches the code default that was already being charged — written down so it is visible and changeable rather than implicit.",
    where: "Settings → Money → Marketplace fee (%)",
  },
  {
    key: "ads.cpcUsd",
    value: 0.05,
    category: "financial",
    why: "Same as the code default. Per-space rates override it; none are set, so every click bills this.",
    where: "Settings → Money → Default cost per click",
  },
];

/**
 * The referral cut on money movement.
 *
 * The owner floated 10% as an example. 5% is used instead because this is paid
 * on BOTH legs and on every deposit an invitee ever makes, not once — and it
 * sits on top of the multi-level commission on earnings. Halving it keeps the
 * incentive and halves a recurring cost that is easy to underestimate.
 *
 * Safe to switch on because the farm guard is already in place: the withdrawal
 * leg pays only up to what that user has actually EARNED, so money deposited
 * and sent straight back out is worth nothing on the way out, and a rolling
 * per-invitee ceiling bounds the deposit leg.
 */
const REFERRAL_PATCH = {
  depositEnabled: true,
  depositPercent: 5,
  withdrawalEnabled: true,
  withdrawalPercent: 5,
};

async function main() {
  console.log(
    `\n=== Platform rates ${APPLY ? "(APPLY)" : "(DRY RUN — nothing will be written)"} ===\n`
  );

  for (const s of SCALARS) {
    const existing = (await prisma.systemSetting.findUnique({
      where: { key: s.key },
      select: { value: true },
    })) as unknown as { value: unknown } | null;

    if (existing) {
      console.log(
        `  SKIP    ${s.key} — already set to ${JSON.stringify(existing.value)}, leaving the owner's value alone`
      );
      continue;
    }
    console.log(`  ${APPLY ? "SET    " : "WOULD SET"} ${s.key} = ${JSON.stringify(s.value)}`);
    console.log(`          ${s.why}`);
    console.log(`          change it at: ${s.where}`);
    if (APPLY) {
      await prisma.systemSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, category: s.category, value: s.value as object },
        update: { value: s.value as object },
      });
    }
  }

  // Referral config is one JSON row, so it is merged rather than replaced —
  // overwriting it would wipe milestones and the anti-farm settings.
  const row = (await prisma.systemSetting.findUnique({
    where: { key: "referral_bonus_config" },
    select: { value: true },
  })) as unknown as { value: unknown } | null;
  const current =
    row?.value && typeof row.value === "object" && !Array.isArray(row.value)
      ? (row.value as Record<string, unknown>)
      : {};
  const merged = { ...current, ...REFERRAL_PATCH };
  console.log(
    `\n  ${APPLY ? "SET    " : "WOULD SET"} referral_bonus_config — deposit ${REFERRAL_PATCH.depositPercent}% / withdrawal ${REFERRAL_PATCH.withdrawalPercent}%, both on`
  );
  console.log(
    "          change it at: Admin → Referrals → A cut of deposits and withdrawals"
  );
  if (APPLY) {
    await prisma.systemSetting.upsert({
      where: { key: "referral_bonus_config" },
      create: {
        key: "referral_bonus_config",
        category: "referral",
        value: merged as object,
      },
      update: { value: merged as object },
    });
  }

  console.log(
    APPLY
      ? "\nApplied. Staff salaries and commission rates are deliberately still unset.\n"
      : "\nDRY RUN — nothing written. Re-run with --apply.\n"
  );
  await prisma.$disconnect();
}

main();
