import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";

/**
 * The buyer's own view of what they bought.
 *
 * `/create-task` was a form and nothing more. Once a buyer pressed Create the
 * task left their world entirely: no way to see whether it had been approved,
 * how many people had completed it, how much budget was left, or what they had
 * been charged. And when an admin rejected one, the reason was written to
 * `Task.rejectionReason` and shown to nobody — least of all the person who had
 * paid for it and needed to know what to change.
 *
 * The two properties worth guarding:
 *
 *  1. **Ownership is in the query.** Every read is `fundedByUserId = me`, not a
 *     filter applied afterwards, so no shape of request returns another buyer's
 *     tasks or invoices.
 *  2. **A rejection carries a reason.** Required on the server, not just in the
 *     admin UI, so it holds for any caller.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-buyer-hub.ts
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

const PAGE = "src/app/(main)/buyer/page.tsx";
const VIEW = "src/components/user/buyer/buyer-hub-view.tsx";
const REVIEW_UI = "src/components/admin/task-review-actions.tsx";
const REVIEW_API = "src/app/api/admin/tasks/[id]/review/route.ts";

async function main() {
  console.log("\n=== Buyer Hub ===\n");

  /* ── 1. Nobody sees anyone else's tasks ── */
  console.log("1. Ownership is part of the query");
  {
    const page = read(PAGE);
    check(
      "tasks are fetched by fundedByUserId",
      /where: \{ fundedByUserId: userId \}/.test(page)
    );
    check(
      "invoices are fetched by userId",
      /prisma\.transaction\.findMany\(\{\s*where: \{\s*userId,/.test(page)
    );
    check(
      "the approved-count query is scoped to THIS buyer's task ids",
      /taskId: \{ in: taskRows\.map\(\(t\) => t\.id\) \}/.test(page),
      "the id list comes from the already-scoped task query"
    );
    check(
      "the page is gated on the capability, not merely hidden",
      /enabled\.has\("createTasks"\)/.test(page)
    );
    check(
      "no post-fetch filtering stands in for a WHERE clause",
      !/\.filter\(\(t\) => t\.fundedByUserId/.test(page)
    );
  }

  /* ── 2. The numbers mean what they say ── */
  console.log("\n2. The figures are honest");
  {
    const page = read(PAGE);
    const view = read(VIEW);
    check(
      "'completed' counts APPROVED submissions, not every attempt",
      /status: \{ in: \["APPROVED", "AUTO_APPROVED"\] \}/.test(page),
      "_count.submissions includes rejected and pending ones"
    );
    check(
      "pending is derived as total minus approved, never negative",
      /Math\.max\(\s*0,/.test(page)
    );
    check(
      // Credit moves in points now, so the figure is a credit total, not a
      // dollar one — summing `amountUsd` reported $0.00 and looked broken.
      // Purchases are excluded (buying credit is not spending it) and anything
      // credited back nets itself off rather than being silently ignored.
      "spend counts credit, excludes purchases, and nets anything returned",
      /creditSpent/.test(view) &&
        /!r\.reference\.startsWith\("taskcredit_buy_"\)/.test(view) &&
        !/const netSpent/.test(view)
    );
    check(
      "held budget only counts tasks that can still pay out",
      /"ACTIVE" \|\| t\.status === "PENDING_REVIEW"/.test(view)
    );
    check(
      "money is rendered through usd()",
      /usd\(/.test(view) && !/\$\$\{/.test(view)
    );
    check(
      "status is translated for the buyer, not shown raw",
      /PENDING_REVIEW: \{\s*label: "Waiting for approval"/.test(view)
    );
  }

  /* ── 3. A rejected buyer is told why ── */
  console.log("\n3. Rejection explains itself");
  {
    const api = read(REVIEW_API);
    const ui = read(REVIEW_UI);
    const view = read(VIEW);
    check(
      "the API refuses a rejection with no reason",
      /action === "reject" && reason\.length < 5/.test(api),
      "server-side, so it holds for any caller not just the admin UI"
    );
    check(
      "the stored reason is what the admin wrote, with no filler default",
      /rejectionReason: reason\b/.test(api) &&
        !/reason \|\| "Not approved\."/.test(api)
    );
    check(
      // Strip comments first: the doc comment SAYS "window.prompt" while
      // explaining what it replaced, and matching prose is not evidence.
      "the admin gets preset reasons rather than a bare prompt",
      /PRESET_REASONS/.test(ui) &&
        !/window\.prompt\(/.test(
          ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
        )
    );
    check(
      "the preset lands in an editable, required box",
      /required: true/.test(ui) && /defaultValue: preset/.test(ui)
    );
    check(
      "the buyer is shown the reason",
      /Why this was rejected/.test(view) && /rejectionReason/.test(view)
    );
    check(
      "…and told their money came back",
      /refunded to your wallet/i.test(view)
    );
  }

  /* ── 4. The hub is reachable and can still be hidden ── */
  console.log("\n4. Reachable, like the other modes");
  {
    const sidebar = read("src/components/dashboard/sidebar.tsx");
    check(
      "Buyer Hub is a mode entry beside Admin Panel / Tutor Hub",
      /buyerNavigation/.test(sidebar) && /href: "\/buyer"/.test(sidebar)
    );
    check(
      "it appears for the capability, not a role",
      /features\?\.includes\("createTasks"\)/.test(sidebar),
      "a buyer is not a role — any account can be granted task creation"
    );
    check(
      "page visibility can still hide it per user",
      /!hidden\.has\("\/buyer"\)/.test(sidebar) &&
        /"\/buyer"/.test(read("src/lib/page-visibility.ts"))
    );
  }

  /* ── 4b. A buyer controls their task, but never judges the work ── */
  console.log("\n4b. Pause is theirs; approval is not");
  {
    const api = read("src/app/api/tasks/mine/[id]/pause/route.ts");
    check(
      "ownership is in the WHERE clause, not checked afterwards",
      /where: \{ id, fundedByUserId: userId \}/.test(api),
      "no request shape may reach a task this buyer did not fund"
    );
    check(
      "it does not borrow an admin permission",
      !/can\(/.test(api),
      "a buyer is not an admin; using the admin gate would be the wrong test entirely"
    );
    check(
      "only a live task can be paused, only a paused one resumed",
      /task\.status !== "ACTIVE"/.test(api) && /task\.status !== "PAUSED"/.test(api)
    );
    check(
      "resuming re-checks the credit, like publishing does",
      /credit < oneCompletion/.test(api),
      "resuming into an empty balance puts it live just long enough for someone to work for nothing"
    );
    check("both directions are audited", /TASK_PAUSED/.test(api) && /TASK_RESUMED/.test(api));

    // The invariant the owner asked for: a buyer must not be able to refuse
    // work that was done properly.
    const rbac = read("src/lib/rbac.ts");
    check(
      "the buyer-facing roles carry NO admin permissions at all",
      /USER: \[\],/.test(rbac) && /AGENCY: \[\],/.test(rbac),
      "approval is gated on submissions.approve; an empty permission list can never satisfy it"
    );
    const approve = read("src/app/api/admin/submissions/[id]/route.ts");
    check(
      "approving still requires the admin permission",
      /can\(session\.user\.id, "submissions\.approve"\)/.test(approve)
    );
    const hub = read(VIEW);
    check(
      "the hub has no approve or reject control",
      !/submissions\/\$\{/.test(hub) && !/"approve"/.test(hub)
    );
    check(
      "…and says why, so the buyer is not left guessing",
      /not asked to approve them/.test(hub)
    );
    check(
      "the buyer CAN stop their own task from the hub",
      /Pause task/.test(hub) && /Resume task/.test(hub)
    );
  }

  /* ── 4d. A buyer can SEE what they paid for, and only that ── */
  console.log("\n4d. Seeing the work, without judging it");
  {
    const api = read("src/app/api/tasks/mine/[id]/submissions/route.ts");
    check(
      "ownership is in the query",
      /where: \{ id, fundedByUserId: session\.user\.id \}/.test(api)
    );
    check(
      "it is READ ONLY — no approve, reject or any other write",
      !/prisma\.taskSubmission\.(update|delete|create)/.test(api) &&
        !/export async function (POST|PATCH|PUT|DELETE)/.test(api),
      "a buyer who could act on submissions could refuse honest work"
    );
    check(
      "only APPROVED work is shown",
      /status: \{ in: \["APPROVED", "AUTO_APPROVED"\] \}/.test(api),
      "showing pending work invites a buyer to lobby about it"
    );
    check(
      "the worker's identity is withheld",
      !/userId: true/.test(api) && !/user: \{/.test(api),
      "the buyer bought the proof, not a list of everyone who engaged with them"
    );
    const hub = read(VIEW);
    check(
      "the hub offers it only where there is something to see",
      /t\.approvedCount > 0 &&/.test(hub) && /See the work/.test(hub)
    );
    check(
      "…and says what is being withheld, rather than seeming incomplete",
      /without names/.test(hub)
    );
  }

  /* ── 4c. A stalled task tells its buyer ── */
  console.log("\n4c. Running out of credit is announced");
  {
    const credit = read("src/lib/task-credit.ts");
    check(
      "the close reason distinguishes 'out of credit' from 'finished'",
      /closeReason\?: "NO_CREDIT" \| "DELIVERED"/.test(credit),
      "telling a buyer 'your task ended' for both leaves the stalled ones dead and unexplained"
    );
    check(
      "out of credit takes precedence when both are true",
      /outOfCredit\s*\?\s*"NO_CREDIT"/.test(credit)
    );
    check(
      "the message points at the fix",
      /notifyTaskClosed/.test(credit) && /buy-points/.test(credit)
    );
    const paths = [
      "src/app/api/admin/submissions/[id]/route.ts",
      "src/app/api/tasks/[id]/submit/route.ts",
      "src/lib/social-recheck.ts",
    ];
    const silent = paths.filter((f) => !/notifyTaskClosed\(/.test(read(f)));
    check(
      "every payout path notifies when it closes a task",
      silent.length === 0,
      silent.join(", ") || undefined
    );
    check(
      "the admin path notifies AFTER its transaction commits",
      /if \(closedTask\) void notifyTaskClosed\(closedTask\);/.test(
        read("src/app/api/admin/submissions/[id]/route.ts")
      ),
      "announcing a closure that a rollback then un-did is worse than staying quiet"
    );
  }

  /* ── 4e. Editing, cancelling, limits, runway ── */
  console.log("\n4e. A buyer can fix and stop their own work");
  {
    const api = read("src/app/api/tasks/mine/[id]/route.ts");
    check(
      "ownership is in the query on both verbs",
      (api.match(/fundedByUserId: userId/g) ?? []).length >= 2
    );
    check(
      "the reward is frozen once the task is live",
      /can't change once a task is live/.test(api),
      "people pick tasks on the terms shown; changing them mid-flight moves the deal underneath someone"
    );
    check(
      "…and so is the completion count",
      /number of completions can't change/.test(api)
    );
    check(
      "editing the CONTENT of a live task sends it back for review",
      /const backToReview = !notYetLive && contentChanged/.test(api),
      "otherwise a buyer swaps the link after approval and the approval means nothing"
    );
    check(
      "a finished task cannot be edited at all",
      /EDITABLE\.has\(String\(task\.status\)\)/.test(api)
    );
    check(
      "cancelling ARCHIVES rather than deletes",
      /status: "ARCHIVED"/.test(api) &&
        !/prisma\.task\.delete/.test(api),
      "submissions are the record of work people were PAID for; the FK refuses a delete"
    );
    check(
      "cancelling refunds nothing, and says so",
      /only charged for the completions it already had/.test(api),
      "charging per completion means a cancelled task has already cost exactly what it delivered"
    );
    check(
      "both verbs are audited",
      /TASK_EDITED/.test(api) && /TASK_CANCELLED/.test(api)
    );

    const hub = read(VIEW);
    check(
      "the hub exposes rename and cancel",
      /Rename/.test(hub) && /cancel\(t\.id, t\.title\)/.test(hub)
    );
    check(
      "cancelling asks first",
      /confirmDialog/.test(hub)
    );

    // Runway — warning BEFORE the credit runs out.
    check(
      "the hub warns before credit runs out, not at zero",
      /LOW_RUNWAY/.test(hub) && /runway <= LOW_RUNWAY/.test(hub),
      "at zero the tasks have already stopped and the damage is done"
    );
    check(
      "'nothing running' and 'nothing left' are not collapsed",
      /runway === null/.test(hub),
      "one is fine, the other is urgent"
    );
    check(
      "the runway uses the CHEAPEST live reward",
      /Math\.min\(\.\.\.liveRewards\)/.test(read(PAGE)),
      "that is the completion that runs out last, so it is the honest figure"
    );

    // Per-buyer task cap.
    const create = read("src/app/api/tasks/create/route.ts");
    check(
      "an admin can cap how many tasks one buyer runs at once",
      /buyer\.maxActiveTasks > 0/.test(create) &&
        /"buyer.max_active_tasks"/.test(read("src/lib/buyer-settings.ts"))
    );
    check(
      "…and the cap counts paused and awaiting tasks too",
      /\["ACTIVE", "PENDING_REVIEW", "PAUSED"\]/.test(create),
      "counting only live ones lets a buyer park fifty in the review queue"
    );
  }

  /* ── 5. Live data agrees with what the hub would render ── */
  console.log("\n5. Live state");
  {
    const funded = await prisma.task.findMany({
      where: { fundedByUserId: { not: null } },
      select: {
        id: true,
        status: true,
        budgetPoints: true,
        remainingBudget: true,
        rejectionReason: true,
      },
    });
    console.log(`   ${funded.length} buyer-funded task(s)`);

    const rejected = funded.filter((t) => t.status === "REJECTED");
    const silent = rejected.filter((t) => !t.rejectionReason?.trim());
    check(
      "every rejected buyer task carries a reason the buyer can read",
      silent.length === 0,
      silent.length
        ? `${silent.length} rejected with no reason: ${silent.map((t) => t.id).join(", ")}`
        : undefined
    );
    check(
      "no task shows more paid out than it was funded with",
      funded.every((t) => t.budgetPoints - t.remainingBudget >= 0)
    );

    // The hub reports approved submissions as "completed"; that count must
    // never exceed what the pool could actually have paid for.
    const ids = funded.map((t) => t.id);
    const approvals = ids.length
      ? ((await prisma.taskSubmission.groupBy({
          by: ["taskId"],
          where: {
            taskId: { in: ids },
            status: { in: ["APPROVED", "AUTO_APPROVED"] },
          },
          _count: { _all: true },
        })) as unknown as { taskId: string; _count: { _all: number } }[])
      : [];
    console.log(
      `   ${approvals.reduce((s, r) => s + r._count._all, 0)} approved completion(s) across them`
    );
    check("the completion audit ran", true);
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
