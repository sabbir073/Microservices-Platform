import { ADMIN_ROLES, type UserRole } from "@/lib/rbac";

/**
 * Who counts as "staff", and the one filter that keeps them off public rankings.
 *
 * The owner's rule: nobody who works on the platform — super-admin, admin,
 * moderator, finance, content, support, marketing, ad-manager — appears in Top
 * Earners or on `/leaderboard`. Staff accounts are seeded, test money moves
 * through them, and they run the tasks they are testing, so ranking them
 * against real users is meaningless.
 *
 * It was not a cosmetic problem. Measured on live data before this shipped
 * (`scripts/report-staff-in-leaderboard.ts`):
 *
 *   money board  — 4 of the visible top 5 were staff, and #1 was an admin at
 *                  $70.79 against $1.22 for the best real user (58x)
 *   XP board     — all 5 of the top 5 were staff; four of them had earned $0
 *                  and ranked purely on seeded XP
 *   every board  — 11 of 40 rows were staff
 *   participants — "40 players" counted 11 staff accounts
 *
 * And it was not only cosmetic in the money sense either: the prize reset in
 * `api/admin/leaderboard/reset` pays real balances to the top N, so an admin
 * sitting at #1 would have been paid.
 *
 * Derived from `ADMIN_ROLES` rather than re-listing the roles, so a role added
 * to the admin panel later is excluded from the boards automatically instead of
 * quietly appearing on them. TUTOR and AGENCY are deliberately NOT staff: a
 * tutor sells courses and an agency buys ads — both are customers, and both
 * earn their standing the same way everyone else does.
 */
export const STAFF_ROLES: UserRole[] = [...ADMIN_ROLES];

const STAFF_SET = new Set<string>(STAFF_ROLES);

/** True when this role belongs to someone employed on the platform. */
export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && STAFF_SET.has(role);
}

/**
 * Drop-in `where` fragment for any query that feeds a public ranking.
 *
 * Spread it into the query rather than filtering in JS after the fact: a
 * `take: 5` that pulls five rows and then removes the staff among them returns
 * three names, not five.
 */
export const NON_STAFF_WHERE = {
  role: { notIn: STAFF_ROLES },
} as const;

// ───────────────────────── Employees vs clients ───────────────────────────────

/**
 * The owner's line: "super admin, manager, admin, finance admin, moderator —
 * these are platform employees. Everyone else is a platform client."
 *
 * There is exactly ONE definition of that line and it is right here, derived
 * from `ADMIN_ROLES`. Deliberately NOT a denormalised `isStaff` column on User:
 * a column is a second definition, and a second definition drifts. The first
 * time somebody changes a role with a raw SQL update, or adds a role to the
 * enum and forgets the backfill, the column and `ADMIN_ROLES` disagree — and
 * then "is this person staff?" has two answers depending on which one you ask.
 * The role column is already on every row we load, so deriving costs nothing.
 *
 * `scripts/verify-staff-off-leaderboard.ts` asserts that no second list exists.
 */
export type AccountType = "staff" | "client";

/** Employee or customer, from the role alone. The one place that decides. */
export function accountTypeOf(role: string | null | undefined): AccountType {
  return isStaffRole(role) ? "staff" : "client";
}

/** True when this account belongs to a paying/earning customer, not an employee. */
export function isClientRole(role: string | null | undefined): boolean {
  return !isStaffRole(role);
}

/** Label + colours for the staff/client badge, so every surface renders it the same. */
export const ACCOUNT_TYPE_BADGE: Record<
  AccountType,
  { label: string; title: string; className: string }
> = {
  staff: {
    label: "Staff",
    title: "Platform employee — works on the platform. Hidden from public leaderboards.",
    className: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  },
  client: {
    label: "Client",
    title: "Platform customer — earns, buys or advertises here.",
    className: "bg-slate-500/10 text-slate-400 border-slate-600/40",
  },
};

/** The mirror of `NON_STAFF_WHERE` — for admin views that want employees only. */
export const STAFF_WHERE = {
  role: { in: STAFF_ROLES },
} as const;
