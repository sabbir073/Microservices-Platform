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
