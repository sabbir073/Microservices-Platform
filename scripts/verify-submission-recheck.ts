import "dotenv/config";
import fs from "fs";
import path from "path";

/**
 * The background re-check.
 *
 * A social page is often not ready the instant it is published, so the first
 * verification says "couldn't read this" and the submission waits for a human.
 * A minute or two later the page is usually there. This job asks again.
 *
 * It pays people without anybody watching, so the two rules that keep it safe
 * are the whole point of this file:
 *   1. it may only ever APPROVE — never reject
 *   2. it cannot pay twice, whatever else is happening to the same row
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-submission-recheck.ts
 */

const root = process.cwd();
const code = (p: string) =>
  fs
    .readFileSync(path.join(root, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const raw = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

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

console.log("\n=== Background re-check of pending submissions ===\n");

const lib = code("src/lib/social-recheck.ts");
const route = code("src/app/api/cron/recheck-submissions/route.ts");

/* ── 1. It may only approve ── */
console.log("1. It only ever approves");
check(
  "it never writes REJECTED",
  !/SubmissionStatus\.REJECTED/.test(lib),
  "nobody is watching a background job; a false negative lands as an unexplained rejection"
);
check(
  "a submission that now genuinely fails is left PENDING",
  /if \(!passed\) \{[\s\S]{0,400}continue;/.test(lib),
  "it records what it saw and hands the decision to a human"
);
check(
  "it re-examines only what could not be READ",
  /statuses\.includes\("unverifiable"\)/.test(lib),
  "a page that was checked and did not match is a decision, not an accident"
);

/* ── 2. It cannot pay twice ── */
console.log("\n2. It cannot pay twice");
check(
  "it claims the row with a CAS while still PENDING",
  /updateMany\(\{\s*where: \{ id: sub\.id, status: SubmissionStatus\.PENDING \}/.test(lib),
  "the same guard the admin review uses"
);
check(
  "…and gives up if somebody else claimed it first",
  /claimed\.count === 0/.test(lib)
);
check(
  "the ledger reference is IDENTICAL to the other two writers",
  /reference: `task_\$\{sub\.taskId\}_\$\{sub\.id\}`/.test(lib),
  "a different key would slip past Transaction @@unique([userId, reference]) and pay a second time"
);
check(
  "a duplicate ledger row is swallowed, not thrown",
  /isDuplicateLedgerError\(e\)/.test(lib),
  "the constraint firing means the backstop worked, not that something broke"
);
check(
  "points, ledger row and the task counter move together",
  /prisma\.\$transaction\(\[[\s\S]{0,900}pointsBalance[\s\S]{0,900}transaction\.create[\s\S]{0,900}completedCount/.test(
    lib
  ),
  "crediting without a ledger row is how money goes missing"
);

/* ── 3. It asks at a sensible time ── */
console.log("\n3. Timing");
check(
  "the SWEEP leaves a submission alone for a moment first",
  /opts\?\.submissionId \? 0 : 60/.test(lib),
  "re-asking a whole batch immediately would just fail again — but a user waiting on their own submission should not be held back"
);
check(
  "…and stops retrying eventually",
  /maxAgeHours = opts\?\.maxAgeHours \?\? 24/.test(lib),
  "past that a human should look rather than a loop running forever"
);
check(
  "it is bounded per run",
  /limit = opts\?\.limit \?\? 25/.test(lib)
);
check(
  "it uses the same crawler-first fetch as the submit path",
  /CRAWLER_UA/.test(lib) && /looksUnreadable/.test(lib),
  "two fetch strategies would mean a submission could verify on one path and not the other"
);

/* ── 4. Who may run it ── */
console.log("\n4. Access");
check(
  "a scheduler authenticates with CRON_SECRET",
  /process\.env\.CRON_SECRET/.test(route) && /Bearer \$\{secret\}/.test(route)
);
check(
  "with no secret set the scheduled route is REFUSED, not left open",
  /if \(secret\) \{/.test(route) && /return false;/.test(route),
  "an unauthenticated endpoint that pays people must not be the default"
);
check(
  "an admin can also trigger it",
  /can\(session\.user\.id, "submissions\.approve"\)/.test(route)
);

/* ── 5. It is actually scheduled ── */
console.log("\n5. Scheduling");
// This used to read `vercel.json`. The platform no longer depends on a cron
// being configured: it schedules itself off its own traffic, so the registry in
// `lib/scheduler/jobs.ts` is where a job is declared and therefore where the
// cadence must be asserted. The HTTP endpoint still exists and still works; it
// is simply no longer what makes this run.
const jobs = raw("src/lib/scheduler/jobs.ts");
check("the job is registered with the scheduler", /name: "recheck-submissions"/.test(jobs));
check(
  "…on a couple of minutes, matching what was asked for",
  /name: "recheck-submissions"[\s\S]{0,600}intervalMs: 2 \* MINUTE/.test(jobs),
  "the ask was that a submitted link resolves within a minute or two"
);
check(
  "…and nothing in the scheduler needs CRON_SECRET to be set",
  !/CRON_SECRET/.test(raw("src/lib/scheduler/run.ts")) &&
    !/CRON_SECRET/.test(jobs),
  "the owner will not configure one, so a job that depends on it never runs"
);
check(
  "vercel.json no longer declares crons at all",
  !("crons" in (JSON.parse(raw("vercel.json")) as Record<string, unknown>)),
  "a leftover cron entry would run the job twice"
);


/* ── 6. It works with no scheduler at all ── */
console.log("\n6. No cron required");
const own = code("src/app/api/tasks/submissions/[id]/recheck/route.ts");
const view = code("src/components/user/tasks/social-task-run-view.tsx");

check(
  "a user can ask about their own submission",
  /recheckPendingSocialSubmissions\(\{[\s\S]{0,160}submissionId: id/.test(own),
  "this is what removes the dependency on a scheduler entirely"
);
check(
  "ownership is part of the QUERY, not a check afterwards",
  /ownerUserId: session\.user\.id/.test(own) &&
    /userId: opts\.ownerUserId/.test(lib),
  "then there is no path where a mistaken id reaches somebody else's submission"
);
check(
  "a settled submission tells the page to stop asking",
  /existing\.status !== "PENDING"[\s\S]{0,140}done: true/.test(own),
  "otherwise the page polls a finished row forever"
);
check(
  "repeated asks are throttled",
  /recheckedAt[\s\S]{0,120}< 8000/.test(own),
  "each check costs an outbound fetch to somebody else's site"
);
check(
  "a targeted check is NOT held back by the sweep's settle delay",
  /opts\?\.submissionId \? 0 : 60/.test(lib),
  "the person is waiting on this exact submission right now"
);
check(
  "the page the user is already on does the asking",
  /submissions\/\$\{submissionId\}\/recheck/.test(view)
);
check(
  "…and stops after about two minutes",
  /attempt >= 8/.test(view),
  "past that a human should look rather than the tab polling all day"
);
check(
  "…backing off rather than hammering",
  /attempt < 3 \? 8000 : 20000/.test(view)
);
check(
  "the user is shown the check happening, and the result",
  /verifyState === "approved"/.test(view) &&
    /verifyState === "checking"/.test(view),
  "the whole point is that they watch it turn green instead of being told to come back"
);
check(
  "the poll is cleaned up when the screen goes away",
  /stop = true;[\s\S]{0,60}clearTimeout\(timer\)/.test(view)
);



/* ── 7. A user-funded task is paid for by its BUYER ── */
console.log("\n7. Funded tasks charge the buyer, never mint");
check(
  "the buyer is charged BEFORE the worker is credited",
  lib.indexOf("chargeTaskCompletion(") <
    lib.indexOf("pointsBalance: { increment: points }"),
  "crediting first and charging after would pay out of a balance that could not cover it"
);
check(
  "it charges through the SHARED helper, not its own arithmetic",
  /chargeTaskCompletion\(prisma, \{/.test(lib),
  "three copies of this is how one path ends up paying for work nobody was billed for"
);
check(
  "a buyer who cannot pay results in NO payout, and the submission goes back",
  /!charge\.paid[\s\S]{0,500}status: SubmissionStatus\.PENDING/.test(lib),
  "the alternative is minting points that no buyer paid for"
);
check(
  "…and the task closes rather than staying advertised",
  /charge\.closeTask[\s\S]{0,300}status: "COMPLETED"/.test(lib)
);
check(
  "the close decision comes from the shared helper too",
  /charge\.closeTask/.test(lib) &&
    /closeTask/.test(code("src/lib/task-credit.ts")),
  "so a task retires at the same moment however it was approved"
);
check(
  "the commission is read once for the batch, not per row",
  /const \{ feePercent \} = await getBuyerSettings\(\)/.test(lib),
  "a settings lookup inside a loop over hundreds of submissions"
);
check(
  "an admin-funded task is unaffected",
  /if \(sub\.task\.fundedByUserId\) \{/.test(lib),
  "only user-created tasks have a buyer to charge"
);


console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
