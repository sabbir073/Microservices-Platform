/**
 * One-time repair of `SystemSetting` rows the admin UI wrote under keys that
 * nothing on the platform ever read.
 *
 * The worst was the withdrawal fee. `/admin/settings` → Financial had a
 * "Withdrawal Fee (%)" box bound to `withdrawal_fee_pct`, while every payout
 * read `withdrawal_fee_percent` (`src/lib/withdrawal.ts`). An owner who set the
 * fee to 2.5% was still charging users the 5% code default, on every withdrawal,
 * for as long as both keys have existed.
 *
 * The rest were controls whose real home is elsewhere (package columns, the
 * `ReferralLevel` table) — their rows are noise that would reappear in an export
 * and confuse the next person, so they go too.
 *
 * Safe to run more than once. Run:
 *   npx tsx scripts/migrate-settings-keys.ts          # report only
 *   npx tsx scripts/migrate-settings-keys.ts --apply  # write
 */
import { prisma } from "./_q";

/** old key → the key the code actually reads. */
const RENAMES: Record<string, string> = {
  withdrawal_fee_pct: "withdrawal_fee_percent",
  // `site_name` was the deleted rival surface's name for the platform. The live
  // form calls it `platform_name`, and that key now really is read (the email
  // From-name and the 2FA issuer). Carry the value across rather than dropping
  // it — this DB has `site_name = "BornToEarn"`, which is somebody's decision,
  // not junk.
  site_name: "platform_name",
};

/**
 * Keys that were never read anywhere, and whose control has been pointed at its
 * real home (or removed) in the settings UI.
 */
const DROPS = [
  // Real home: Package.taskRewardMultiplier / Package.dailyTaskLimit.
  "task_reward_multiplier",
  "max_tasks_per_day",
  // Real home: the ReferralLevel table (/admin/referrals/settings).
  "referral_l1_pct",
  "referral_l2_pct",
  "referral_l3_pct",
  // No enforcement exists and the real limits are per-upload-kind / per-route.
  "file_upload_max_mb",
  "api_rate_limit_per_min",
  // From the deleted rival settings surface — duplicates of live keys.
  "smtp_user", // → smtp_username
  "from_email", // → email_from_address
  "from_name", // → email_from_name
  "kyc_required", // → ui.require_kyc_for_withdrawal
  "require_email_verification", // → ui.require_email_verification
  "push_enabled", // → push_notifications_enabled
  // Never read by anything, and no behaviour was ever attached to them.
  "daily_earning_limit",
  "kyc_min_withdrawal",
  "lockout_duration",
];

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.systemSetting.findMany({
    select: { id: true, key: true, value: true, category: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const plan: string[] = [];

  for (const [from, to] of Object.entries(RENAMES)) {
    const src = byKey.get(from);
    if (!src) continue;
    const dst = byKey.get(to);

    if (!dst) {
      plan.push(`MOVE  ${from} → ${to}   value=${JSON.stringify(src.value)}`);
      if (apply) {
        await prisma.systemSetting.create({
          data: {
            key: to,
            value: src.value === null ? {} : src.value,
            category: src.category ?? "financial",
          },
        });
        await prisma.systemSetting.delete({ where: { id: src.id } });
      }
    } else if (JSON.stringify(dst.value) !== JSON.stringify(src.value)) {
      // Both rows exist and disagree. The one the code reads wins — silently
      // overwriting a live payout rate with a value that has never been in
      // effect would change what users are charged without anyone asking.
      plan.push(
        `KEEP  ${to}=${JSON.stringify(dst.value)} (live)  ·  DROP ${from}=${JSON.stringify(src.value)} (never used)`
      );
      if (apply) await prisma.systemSetting.delete({ where: { id: src.id } });
    } else {
      plan.push(`DROP  ${from} (identical to ${to})`);
      if (apply) await prisma.systemSetting.delete({ where: { id: src.id } });
    }
  }

  for (const key of DROPS) {
    const row = byKey.get(key);
    if (!row) continue;
    plan.push(`DROP  ${key}=${JSON.stringify(row.value)} (nothing read it)`);
    if (apply) await prisma.systemSetting.delete({ where: { id: row.id } });
  }

  if (plan.length === 0) {
    console.log("Nothing to do — no stale settings rows found.");
  } else {
    console.log(plan.join("\n"));
    console.log(
      apply
        ? `\nApplied ${plan.length} change(s).`
        : `\n${plan.length} change(s) pending. Re-run with --apply to write.`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
