import "dotenv/config";
import fs from "fs";
import path from "path";

/**
 * Staff must not appear on any public ranking.
 *
 * The owner's rule: nobody who works on the platform shows up in Top Earners or
 * on `/leaderboard`. Measured before the fix (`report-staff-in-leaderboard.ts`),
 * 4 of the top 5 earners and 5 of the top 5 on XP were staff accounts.
 *
 * These checks are structural rather than behavioural because the failure mode
 * is not "the filter breaks" — it is "someone adds a fifth board, or a second
 * Top Earners widget, and forgets the filter". So every ranking query in the
 * public paths is enumerated here by hand: adding one without a `where` makes
 * this suite fail, which is the whole point.
 */

import {
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  FINANCE_PERMISSIONS,
  MANAGER_FORBIDDEN_ROLES,
  PERMISSION_META,
  ROLE_META,
  ADMIN_ROLES,
  stripProtectedForRole,
  canAssignStaffRole,
  canAdministerStaffAccount,
  type Permission,
  type UserRole,
} from "../src/lib/rbac";
import { isStaffRole, accountTypeOf } from "../src/lib/staff";
import { FEATURES } from "../src/lib/features";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

const staff = read("src/lib/staff.ts");
const rbac = read("src/lib/rbac.ts");
const api = read("src/app/api/leaderboard/route.ts");
const lib = read("src/lib/leaderboard.ts");
const social = read("src/app/(main)/social/page.tsx");
// The ranking + payout used to live inside the admin route. Both the admin
// button and the Vercel cron now call `lib/leaderboard-reset`, so THAT is the
// file the prize-money checks below have to interrogate — the route is a
// wrapper, and asserting against a wrapper proves nothing.
const reset = read("src/lib/leaderboard-reset.ts");
const resetRoute = read("src/app/api/admin/leaderboard/reset/route.ts");
const cron = read("src/app/api/cron/leaderboard-reset/route.ts");
const gate = read("src/lib/leaderboard-gate.ts");

console.log("\n--- one definition of staff ---");
check(
  "staff is derived from ADMIN_ROLES, not a second hand-written list",
  /STAFF_ROLES[^=]*=\s*\[\.\.\.ADMIN_ROLES\]/.test(staff)
);
check(
  "…and ADMIN_ROLES still covers every admin-panel role",
  [
    "SUPER_ADMIN",
    "MANAGER",
    "ADMIN",
    "FINANCE_ADMIN",
    "CONTENT_ADMIN",
    "SUPPORT_ADMIN",
    "MARKETING_ADMIN",
    "MODERATOR",
    "AD_MANAGER",
  ].every((r) =>
    new RegExp(`ADMIN_ROLES[\\s\\S]{0,400}"${r}"`).test(rbac)
  )
);
check(
  "the filter is a where fragment, so it applies before `take`",
  /NON_STAFF_WHERE\s*=\s*\{\s*role:\s*\{\s*notIn:\s*STAFF_ROLES/.test(staff)
);
check(
  "TUTOR and AGENCY are not treated as staff — they are customers",
  !/"TUTOR"/.test(staff) && !/"AGENCY"/.test(staff)
);

console.log("\n--- the public boards ---");
// Every findMany that ranks users in the public API, each checked for the
// filter individually: a shared assertion would pass while one board leaks.
// The points board no longer ranks users with a findMany at all — it ranks the
// TaskSubmission aggregate and then hydrates the winners by id, so its staff
// filter lives inside `topTaskEarners` (asserted further down) rather than here.
check(
  "the points board excludes staff via the shared task-earnings source",
  /topTaskEarners\(limit\)/.test(api) &&
    !/orderBy: \{ totalEarnings: "desc" \}/.test(api)
);
for (const [label, order] of [
  ["xp", 'orderBy: { xp: "desc" }'],
  ["referrals", "referrals: { _count: \"desc\" }"],
  ["tasks", "taskSubmissions: { _count: \"desc\" }"],
] as const) {
  const idx = api.indexOf(order);
  const window = idx === -1 ? "" : api.slice(Math.max(0, idx - 220), idx);
  check(
    `the ${label} board excludes staff`,
    idx !== -1 && /where: NON_STAFF_WHERE/.test(window),
    idx === -1 ? `could not find the ${label} query` : undefined
  );
}
check(
  "the combined board excludes staff at the source",
  /where: NON_STAFF_WHERE,\s*\n\s*orderBy: \{ totalEarnings: "desc" \}/.test(lib)
);
// Not a count comparison — every user findMany in the file must carry the
// filter as its first key, so a fifth board added later fails here.
const userQueries = api.match(/prisma\.user\.findMany\(\{\s*\n\s*[^\n]*/g) ?? [];
// Either the bare fragment (`where: NON_STAFF_WHERE`) or spread into a `where`
// that also narrows by id — both put the filter in the query, which is the
// invariant. Anything else is a board that leaks.
const filtered = (q: string) =>
  /where: NON_STAFF_WHERE/.test(q) || /\.\.\.NON_STAFF_WHERE/.test(q);
check(
  `no ranking query in the public API is left unfiltered (${userQueries.length} found)`,
  userQueries.length >= 4 && userQueries.every(filtered),
  userQueries.filter((q) => !filtered(q)).join("\n       ")
);
check(
  "the participant count matches the population on the board",
  /prisma\.user\.count\(\{ where: NON_STAFF_WHERE \}\)/.test(api)
);
check(
  "a staff viewer gets no rank line on either board",
  (api.match(/!isStaffRole\(session\.user\.role\)/g) ?? []).length === 2
);

console.log("\n--- Top Earners in the feed rail ---");
check(
  "the widget query excludes staff",
  /where: NON_STAFF_WHERE,\s*\n\s*orderBy: \{ totalEarnings: "desc" \},\s*\n\s*take: 5/.test(
    social
  )
);
check(
  "…filtered in the query, not after the take",
  !/bestEarners[\s\S]{0,200}\.filter\(/.test(social)
);

console.log("\n--- the prize money ---");
// This is the half that is not cosmetic: the reset pays real balance.
check(
  "every single-metric prize pool excludes staff",
  (reset.match(/where: NON_STAFF_WHERE/g) ?? []).length >= 4
);
check(
  "the combined prize pool goes through the shared (filtered) lib",
  /computeCombinedTopUsers\(\{/.test(reset)
);
check(
  "the minimum-entries gate counts the same population",
  /prisma\.user\.count\(\{ where: NON_STAFF_WHERE \}\)/.test(reset)
);

console.log("\n--- admin reporting is deliberately NOT filtered ---");
// Finance and analytics report where the money actually went. Hiding staff
// there would be hiding real balances from the person who has to reconcile them.
check(
  "admin analytics still reports every account",
  !/NON_STAFF_WHERE/.test(read("src/app/admin/analytics/page.tsx"))
);
check(
  "admin finance still reports every account",
  !/NON_STAFF_WHERE/.test(read("src/app/admin/finance/page.tsx"))
);

/* ────────────────────────────────────────────────────────────────
   Rank is earned from TASKS, and cannot be bought in the marketplace
   ──────────────────────────────────────────────────────────────── */
console.log("\n--- the board ranks on task earnings, and the payout agrees ---");

// Same failure shape as the staff one above: the filter does not "break", it
// gets forgotten by whoever adds the next board. So each ranking path is named.
const strip = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const libCode = strip(lib);
const apiCode = strip(api);
const resetCode = strip(reset);

check(
  "there is one definition of what 'earned' means, and it is paid submissions",
  /PAID_SUBMISSION[\s\S]{0,200}status: \{ in: \["APPROVED", "AUTO_APPROVED"\] \}/.test(
    libCode
  ) && /pointsEarned: \{ gt: 0 \}/.test(libCode)
);
check(
  "the top list is ordered by the SUM in the database, not by a proxy column",
  /orderBy: \{ _sum: \{ pointsEarned: "desc" \} \}/.test(libCode),
  "ordering a pool by totalEarnings and re-ranking only reorders that pool"
);
check(
  "topTaskEarners drops staff at the shared source",
  /topTaskEarners[\s\S]{0,900}\.\.\.NON_STAFF_WHERE/.test(libCode)
);
check(
  "the combined score's points component is task earnings",
  /points: earnedByUser\.get\(u\.id\) \?\? 0/.test(libCode),
  "toNum(u.totalEarnings) here is what made rank purchasable"
);
check(
  "no ranking path still sorts users by totalEarnings to produce a VALUE",
  !/value: Math\.round\(toNum\(u\.totalEarnings\)/.test(apiCode) &&
    !/value: Math\.round\(toNum\(u\.totalEarnings\)/.test(resetCode)
);
check(
  "the public points board calls topTaskEarners(",
  /topTaskEarners\(limit\)/.test(apiCode)
);
check(
  "the 'your rank' line uses the same basis",
  /taskEarningsFor\(\[session\.user\.id\]\)/.test(apiCode),
  "ranking one way and reporting another is the same bug twice"
);
check(
  "the PRIZE-PAYING reset uses the same function as the board",
  /metric === "POINTS_EARNED"[\s\S]{0,900}topTaskEarners\(POOL\)/.test(resetCode),
  "a board that ranks one way and pays another is worse than either"
);

/* ────────────────────────────────────────────────────────────────
   lb_enabled — off means off, not hidden
   ──────────────────────────────────────────────────────────────── */
console.log("\n--- the leaderboard switch is a real switch ---");

const gateCode = strip(gate);
check(
  "there is ONE shared guard, not a copy per surface",
  /export async function isLeaderboardEnabled/.test(gateCode) &&
    /export async function leaderboardDisabled/.test(gateCode) &&
    /lb_enabled/.test(gateCode)
);
check(
  "the boards API refuses a saved request, not just the page",
  /leaderboardDisabled\(\)/.test(apiCode) && /if \(off\) return off;/.test(apiCode),
  "a bookmarked fetch reaches /api/leaderboard directly — hiding the nav does nothing to it"
);
check(
  "the page refuses a bookmarked URL",
  /isLeaderboardEnabled\(\)/.test(strip(read("src/app/(main)/leaderboard/page.tsx")))
);
check(
  "the nav entry goes through the existing hidden-paths resolver",
  /isLeaderboardEnabled\(\)[\s\S]{0,200}hidden\.push\("\/leaderboard"\)/.test(
    strip(read("src/lib/page-visibility-server.ts"))
  ),
  "one resolver feeds the sidebar, the bottom bar and the route guard"
);
check(
  "the switch fails ON, so a settings blip cannot delete the feature",
  /getSetting<unknown>\(KEY, null\), true\)/.test(gateCode) &&
    /catch \{\s*return true;/.test(gateCode)
);

/* ────────────────────────────────────────────────────────────────
   lb_auto_reset — the scheduled payout cannot pay twice
   ──────────────────────────────────────────────────────────────── */
console.log("\n--- the scheduled payout is idempotent ---");

const cronCode = strip(cron);
const resetRouteCode = strip(resetRoute);

check(
  "the cron reuses the admin payout instead of growing a second one",
  /runLeaderboardReset\(/.test(cronCode) &&
    /runLeaderboardReset\(/.test(resetRouteCode) &&
    // The route must be a wrapper: no ranking, no ledger write of its own.
    !/prisma\./.test(resetRouteCode),
  "two payout implementations drift, and the one that drifts is the one paying money"
);
check(
  "it is scheduled by Vercel cron, like the existing job",
  /"path": "\/api\/cron\/leaderboard-reset"/.test(read("vercel.json"))
);
check(
  "the cron endpoint is authenticated the way the existing one is",
  /CRON_SECRET/.test(cronCode) &&
    /Bearer \$\{secret\}/.test(cronCode) &&
    /leaderboards\.manage/.test(cronCode),
  "an unauthenticated endpoint that pays real balance is not something to default to on"
);
check(
  "nothing runs unless lb_auto_reset is ON, and an absent setting means OFF",
  /lb_auto_reset/.test(cronCode) && /return false;/.test(cronCode)
);
// `lb_auto_reset` was already TRUE in the live database years before anything
// read it. Since each tick settles the most recently closed window, the very
// first tick after deploy would otherwise pay out yesterday, last week and last
// month — real points and XP, for periods nobody competed in under these rules.
check(
  "the first ever run seals the already-closed windows instead of paying them",
  /lb_auto_reset_live_since/.test(cronCode) &&
    /sealedWithoutPayout/.test(cronCode),
  "without this, switching the scheduler on is a retroactive payout nobody authorised"
);
check(
  "…and it claims that moment with create(), so two cold starts cannot both seal",
  /systemSetting\.create\(/.test(cronCode),
  "an upsert here would let a racing invocation move the line forward twice"
);
check(
  "the seal marks the cycle completed, so the normal path skips it forever",
  /sealedWithoutPayout: true,[\s\S]{0,200}reason:/.test(cronCode) &&
    /completed: true,/.test(cronCode)
);
check(
  "a cycle is keyed by the WINDOW it pays, never by when the job ran",
  /export function cycleKey/.test(resetCode) &&
    !/Date\.now\(\)_/.test(resetCode) &&
    /`leaderboard_\$\{cycleId\}_\$\{w\.userId\}`/.test(resetCode),
  "a run-time key makes the ledger's @@unique([userId, reference]) unreachable"
);
check(
  "the cycle is CLAIMED before a point moves, and the claim is a create",
  /prisma\.systemSetting\.create\(\{[\s\S]{0,300}key: historyKey/.test(resetCode),
  "upsert here lets a second runner overwrite the frozen winner list mid-payout"
);
check(
  "losing the claim race RESUMES the winner's frozen list, it does not re-rank",
  /isUniqueViolation\(err\)[\s\S]{0,600}frozen = parseFrozen\(/.test(resetCode),
  "re-ranking on a retry pays whoever is top NOW, on top of whoever was paid before"
);
check(
  "a settled cycle short-circuits before any ranking query",
  /alreadyCompleted: true/.test(resetCode) && /completed: true/.test(resetCode)
);
check(
  "a duplicate payout is caught as a SKIP via the ledger, not a 500",
  /isDuplicateLedgerError\(err\)\) return "skipped"/.test(resetCode)
);
check(
  "the admin path reports a double-run as 409 rather than success",
  /out\.paid === 0 && out\.skipped > 0/.test(resetRouteCode),
  "'reset complete, 0 paid' reads like it worked"
);
check(
  "the balance moves by compare-and-set, never a bare update",
  /tx\.user\.updateMany\(\{[\s\S]{0,400}pointsBalance: before\.pointsBalance,/.test(
    resetCode
  ) && /cas\.count !== 1/.test(resetCode),
  "an increment on a stale read silently loses a concurrent credit"
);
check(
  "the payout loop is OUTSIDE the transaction (Accelerate P6005 at 15s)",
  /for \(const w of frozen\)[\s\S]{0,200}await payWinner\(/.test(resetCode) &&
    !/\$transaction\([\s\S]{0,200}for \(const w of frozen\)/.test(resetCode)
);
check(
  "staff are excluded from the SCHEDULED prizes too, at the shared source",
  /where: NON_STAFF_WHERE/.test(resetCode) &&
    /computeCombinedTopUsers\(\{/.test(resetCode)
);
check(
  "lb_min_entries and lb_eligible_packages gate the scheduled path as well",
  /lb_min_entries/.test(resetCode) && /getEligiblePackages\(\)/.test(resetCode)
);
check(
  "the closing window is computed from the calendar, so a missed run catches up",
  /export function lastClosedWindowAnchor/.test(resetCode) &&
    /lastClosedWindowAnchor\(period, now\)/.test(cronCode),
  "'when did I last run' skips a payout after an outage"
);
check(
  "every boundary is UTC — one instant worldwide, not a drifting local midnight",
  /getUTC/.test(resetCode) && !/getFullYear\(\)|getMonth\(\)|getDate\(\)/.test(
    resetCode.replace(/getUTC\w+\(\)/g, "")
  )
);

/* ────────────────────────────────────────────────────────────────
   XP prizes and gift items
   ──────────────────────────────────────────────────────────────── */
console.log("\n--- XP prizes and gifts are real ---");

check(
  "the XP distributions are read and credited alongside the points",
  /lb_\$\{period\}_xp_distribution/.test(resetCode) && /xp: nextXp/.test(resetCode)
);
check(
  "XP uses the ONE curve in lib/level, not a second one",
  /from "@\/lib\/level"/.test(resetCode) && /calculateLevel\(nextXp\)/.test(resetCode),
  "a level computed from a private curve locks users out of minLevel content"
);
check(
  "an absent XP list means zero, not an invented default",
  /export function distributeXp\(count: number, custom: number\[\] \| null\)/.test(
    resetCode
  ) && /out\.push\([\s\S]{0,120}: 0\);/.test(resetCode),
  "points have a pool to spread; XP has no pool, so an empty list must mean zero XP"
);
check(
  "a gift award records WHO is owed WHAT, and the winner is told",
  /leaderboardGiftAward\.create/.test(resetCode) &&
    /NotificationType\.ACHIEVEMENT[\s\S]{0,400}\$\{w\.gift\}/.test(resetCode)
);
check(
  "a gift cannot be owed twice for one cycle+rank",
  /@@unique\(\[cycleId, rank\]\)/.test(read("prisma/schema.prisma"))
);
check(
  "an admin can see who is owed what and mark it fulfilled",
  /leaderboardGiftAward\.findMany/.test(
    read("src/app/api/admin/leaderboard/gifts/route.ts")
  ) &&
    /FULFILLED/.test(read("src/app/api/admin/leaderboard/gifts/route.ts")) &&
    /targetUserId: existing\.userId/.test(
      read("src/app/api/admin/leaderboard/gifts/route.ts")
    )
);
check(
  "no control still tells the admin it is 'Not wired up yet'",
  !/Not wired up yet/.test(
    read("src/components/admin/leaderboard/leaderboard-settings-form.tsx")
  ),
  "the six lb_* controls are live now — a stale warning is its own lie"
);

// ═══════════════════════════════════════════════════════════════════════════
// RBAC: the Manager tier, and the one definition of "staff"
// ═══════════════════════════════════════════════════════════════════════════
//
// Unlike the ranking checks above, these are BEHAVIOURAL — the functions are
// pure and client-safe, so they are called for real rather than grepped. A
// regex can be satisfied by a comment; `canAssignStaffRole("MANAGER",
// "SUPER_ADMIN")` returning ok cannot.
//
// The three that must never go green-to-red:
//   1. a Manager cannot reach finance
//   2. a Manager cannot escalate to super admin
//   3. staff/client classification has exactly one definition

console.log("\n--- the Manager cannot reach finance ---");

const managerPerms = new Set(ROLE_PERMISSIONS.MANAGER);
check(
  "MANAGER's default set contains no finance permission",
  FINANCE_PERMISSIONS.every((p) => !managerPerms.has(p)),
  FINANCE_PERMISSIONS.filter((p) => managerPerms.has(p)).join(", ")
);
check(
  "MANAGER is broad otherwise (it is a real tier, not a stub)",
  managerPerms.size === ALL_PERMISSIONS.length - FINANCE_PERMISSIONS.length,
  `${managerPerms.size} of ${ALL_PERMISSIONS.length}`
);
check(
  "MANAGER keeps admins.manage — administering staff IS the role",
  managerPerms.has("admins.manage") && managerPerms.has("admin.activity")
);

// The attack: a manager grants themselves finance via the role config or a
// per-user override. The write may land; the resolve must not honour it.
for (const perm of FINANCE_PERMISSIONS) {
  const smuggled = new Set<Permission>([perm, "users.view"]);
  stripProtectedForRole(smuggled, "MANAGER");
  check(
    `a MANAGER granted "${perm}" still resolves without it`,
    !smuggled.has(perm) && smuggled.has("users.view"),
    "stripProtectedForRole runs last in getEffectivePermissions — if this fails, a manager can self-grant finance"
  );
}
check(
  "…and FINANCE_ADMIN still keeps finance (the strip is not a blanket ban)",
  stripProtectedForRole(new Set<Permission>(["finance.view"]), "FINANCE_ADMIN").has(
    "finance.view"
  )
);
check(
  "…and SUPER_ADMIN still keeps finance",
  stripProtectedForRole(new Set<Permission>(["finance.view"]), "SUPER_ADMIN").has(
    "finance.view"
  )
);

check(
  "a MANAGER cannot promote anyone to FINANCE_ADMIN",
  !canAssignStaffRole("MANAGER", "FINANCE_ADMIN").ok
);
check(
  "a MANAGER cannot edit a FINANCE_ADMIN account (role, password or anything else)",
  !canAdministerStaffAccount("MANAGER", "FINANCE_ADMIN").ok
);
check(
  "a MANAGER cannot remove a FINANCE_ADMIN",
  !canAdministerStaffAccount("MANAGER", "FINANCE_ADMIN").ok,
  "delete runs the same check as edit — see the DELETE handler"
);

console.log("\n--- the Manager cannot escalate ---");

check(
  "a MANAGER cannot promote anyone (including themselves) to SUPER_ADMIN",
  !canAssignStaffRole("MANAGER", "SUPER_ADMIN").ok
);
check(
  "a MANAGER cannot edit a SUPER_ADMIN account",
  !canAdministerStaffAccount("MANAGER", "SUPER_ADMIN").ok
);
check(
  "a MANAGER cannot mint another MANAGER",
  !canAssignStaffRole("MANAGER", "MANAGER").ok
);
check(
  "a MANAGER cannot edit another MANAGER",
  !canAdministerStaffAccount("MANAGER", "MANAGER").ok
);
check(
  "MANAGER_FORBIDDEN_ROLES covers exactly super/finance/manager",
  ["SUPER_ADMIN", "FINANCE_ADMIN", "MANAGER"].every((r) =>
    MANAGER_FORBIDDEN_ROLES.includes(r as UserRole)
  ) && MANAGER_FORBIDDEN_ROLES.length === 3
);
check(
  "…but a MANAGER CAN still administer the staff it is meant to (it is not inert)",
  ["ADMIN", "MODERATOR", "SUPPORT_ADMIN", "CONTENT_ADMIN", "MARKETING_ADMIN", "AD_MANAGER"].every(
    (r) =>
      canAdministerStaffAccount("MANAGER", r as UserRole).ok &&
      canAssignStaffRole("MANAGER", r as UserRole).ok
  )
);
// The hole this closed: role changes were gated to super admin, but password
// and email were not, on every admin account below super.
check(
  "a non-manager admin cannot touch ANY staff account, not just a super admin",
  ["FINANCE_ADMIN", "MODERATOR", "ADMIN", "MANAGER"].every(
    (r) => !canAdministerStaffAccount("SUPPORT_ADMIN", r as UserRole).ok
  ),
  "a SUPPORT_ADMIN who can reset the finance admin's password does not need to escalate their own role"
);
check(
  "…but any users.edit admin can still edit ordinary customers",
  canAdministerStaffAccount("SUPPORT_ADMIN", "USER").ok &&
    canAdministerStaffAccount("SUPPORT_ADMIN", "TUTOR").ok &&
    canAdministerStaffAccount("SUPPORT_ADMIN", "AGENCY").ok
);
check(
  "a SUPER_ADMIN is still unrestricted",
  canAdministerStaffAccount("SUPER_ADMIN", "FINANCE_ADMIN").ok &&
    canAssignStaffRole("SUPER_ADMIN", "SUPER_ADMIN").ok
);

console.log("\n--- exactly ONE definition of staff vs client ---");

check(
  "MANAGER is in ADMIN_ROLES, so it is staff without anyone saying so twice",
  isStaffRole("MANAGER") && ADMIN_ROLES.includes("MANAGER")
);
check(
  "accountTypeOf agrees with isStaffRole on every role in the enum",
  (Object.keys(ROLE_PERMISSIONS) as UserRole[]).every(
    (r) => (accountTypeOf(r) === "staff") === isStaffRole(r)
  )
);
check(
  "every admin-panel role classifies as staff; TUTOR/AGENCY/USER as client",
  ADMIN_ROLES.every((r) => accountTypeOf(r) === "staff") &&
    ["USER", "TUTOR", "AGENCY"].every((r) => accountTypeOf(r) === "client")
);
check(
  "no denormalised isStaff column on User — a second definition would drift",
  !/\n\s+isStaff\s+Boolean/.test(read("prisma/schema.prisma")),
  "staff-ness is derived from the role, which is already on every row we load"
);
check(
  "the badge surfaces call accountTypeOf() instead of re-listing the roles",
  ["src/components/admin/users-table-client.tsx", "src/app/admin/users/[id]/page.tsx"].every(
    (f) =>
      /accountTypeOf\(/.test(read(f)) &&
      !/"SUPER_ADMIN"[\s\S]{0,200}"FINANCE_ADMIN"/.test(read(f))
  )
);

console.log("\n--- every permission and feature is explained ---");

check(
  "every permission has a one-line plain-language description",
  ALL_PERMISSIONS.every((p) => !!PERMISSION_META[p]?.description),
  ALL_PERMISSIONS.filter((p) => !PERMISSION_META[p]?.description).join(", ")
);
check(
  "every user-facing feature has one too",
  FEATURES.every((f) => !!f.description),
  FEATURES.filter((f) => !f.description).map((f) => f.key).join(", ")
);
check(
  "every role has one",
  (Object.keys(ROLE_PERMISSIONS) as UserRole[]).every(
    (r) => !!ROLE_META[r]?.description
  )
);
check(
  "the advertiser FEATURE and the AD_MANAGER ROLE are explicitly distinguished",
  /advertiser/i.test(ROLE_META.AD_MANAGER.description) &&
    /Ad Manager/i.test(
      FEATURES.find((f) => f.key === "advertiser")?.description ?? ""
    ),
  "granting AD_MANAGER to a buyer hands them every advertiser's campaigns — the page must say so on both sides"
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
