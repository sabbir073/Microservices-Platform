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
const reset = read("src/app/api/admin/leaderboard/reset/route.ts");

console.log("\n--- one definition of staff ---");
check(
  "staff is derived from ADMIN_ROLES, not a second hand-written list",
  /STAFF_ROLES[^=]*=\s*\[\.\.\.ADMIN_ROLES\]/.test(staff)
);
check(
  "…and ADMIN_ROLES still covers every admin-panel role",
  [
    "SUPER_ADMIN",
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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
