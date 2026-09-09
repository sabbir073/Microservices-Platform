import "server-only";
import { getSetting } from "@/lib/system-settings";

/**
 * The password rules, in one place, read from the admin **Security settings**.
 *
 * `password_min_length` and `require_strong_passwords` were two boxes on that
 * screen that wrote `SystemSetting` rows nothing read. Meanwhile five separate
 * routes each hardcoded `z.string().min(8)` — and only two of them checked
 * character classes at all, so where you set your password decided how strong
 * it had to be. Changing the admin's number changed none of them.
 *
 * Bounds are deliberate: below 6 is not a password, and above 64 locks people
 * out of their own password managers' generated defaults.
 */
export const PASSWORD_MIN_FLOOR = 6;
export const PASSWORD_MIN_CEILING = 64;

export interface PasswordPolicy {
  minLength: number;
  /** Require a lowercase letter, an uppercase letter and a digit. */
  requireStrong: boolean;
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const [min, strong] = await Promise.all([
    getSetting<number>("password_min_length", 8),
    getSetting<boolean>("require_strong_passwords", true),
  ]);
  const n = Math.floor(Number(min));
  return {
    minLength: Number.isFinite(n)
      ? Math.min(PASSWORD_MIN_CEILING, Math.max(PASSWORD_MIN_FLOOR, n))
      : 8,
    requireStrong: strong !== false,
  };
}

/** Null when the password is acceptable, otherwise the message to show. */
export function checkPassword(
  password: string,
  policy: PasswordPolicy
): string | null {
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }
  if (policy.requireStrong && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
  }
  return null;
}

/**
 * Validate against the current policy. Separate from `checkPassword` so callers
 * inside a Zod pipeline can await the policy once and stay synchronous after.
 */
export async function validatePassword(
  password: string
): Promise<string | null> {
  return checkPassword(password, await getPasswordPolicy());
}
