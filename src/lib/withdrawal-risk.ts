// Withdrawal risk assessment heuristics (admin_oo.md §5.07)
//
// Real fraud detection lives in Phase 4's Fraud Monitor module. This is a
// lightweight first-pass that gives admins a Low/Medium/High signal for
// triage on the withdrawals queue and detail page.

export type RiskLevel = "low" | "medium" | "high";

export interface RiskInputs {
  amount: number;
  userKycStatus: string;
  userPackageTier: string;
  accountAgeDays: number; // days since user.createdAt
  previousSuccessfulWithdrawals: number; // count COMPLETED
  previousRejectedWithdrawals: number; // count REJECTED
  /** Other accounts that withdrew to / saved the same payout number. */
  otherUsersSameAccount?: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0–100
  flags: string[];
  checks: Array<{ label: string; ok: boolean }>;
}

export function assessWithdrawalRisk(inputs: RiskInputs): RiskAssessment {
  const flags: string[] = [];
  const checks: Array<{ label: string; ok: boolean }> = [];
  let score = 0;

  // KYC
  if (inputs.userKycStatus === "APPROVED") {
    checks.push({ label: "KYC verified", ok: true });
  } else {
    checks.push({ label: "KYC verified", ok: false });
    score += inputs.amount > 100 ? 25 : 10;
    if (inputs.amount > 100) flags.push("Large amount without KYC");
  }

  // Account age
  if (inputs.accountAgeDays >= 30) {
    checks.push({ label: "Account ≥ 30 days old", ok: true });
  } else if (inputs.accountAgeDays >= 7) {
    checks.push({ label: "Account ≥ 7 days old", ok: true });
    score += 10;
  } else {
    checks.push({ label: "Account ≥ 7 days old", ok: false });
    score += 25;
    flags.push("Brand-new account");
  }

  // History
  if (inputs.previousSuccessfulWithdrawals > 0) {
    checks.push({
      label: `${inputs.previousSuccessfulWithdrawals} successful withdrawal${
        inputs.previousSuccessfulWithdrawals === 1 ? "" : "s"
      }`,
      ok: true,
    });
  } else {
    checks.push({ label: "Has withdrawal history", ok: false });
    score += 15;
    flags.push("First-ever withdrawal");
  }

  if (inputs.previousRejectedWithdrawals > 0) {
    score += 10 * inputs.previousRejectedWithdrawals;
    flags.push(
      `${inputs.previousRejectedWithdrawals} previous rejection${
        inputs.previousRejectedWithdrawals === 1 ? "" : "s"
      }`
    );
    checks.push({ label: "No prior rejections", ok: false });
  } else {
    checks.push({ label: "No prior rejections", ok: true });
  }

  // Amount tiers
  if (inputs.amount > 500) {
    score += 20;
    flags.push("Large amount (> $500)");
  } else if (inputs.amount > 100) {
    score += 10;
  }

  // One bKash / Nagad number collecting for several accounts is what an
  // account farm cashing out looks like (KYC per account does not catch it).
  if ((inputs.otherUsersSameAccount ?? 0) > 0) {
    score += 30;
    flags.push(`Same payout number used by ${inputs.otherUsersSameAccount} other account${inputs.otherUsersSameAccount === 1 ? "" : "s"}`);
    checks.push({ label: "Payout number used only by this account", ok: false });
  } else if (inputs.otherUsersSameAccount === 0) {
    checks.push({ label: "Payout number used only by this account", ok: true });
  }

  // Package
  if (inputs.userPackageTier === "FREE") {
    score += 5;
  }

  const level: RiskLevel = score >= 50 ? "high" : score >= 25 ? "medium" : "low";

  return { level, score: Math.min(100, score), flags, checks };
}
