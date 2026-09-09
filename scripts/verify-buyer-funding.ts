import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { quoteTask } from "../src/lib/buyer-quote";

/**
 * Buyers funding tasks — the rules an admin can set, and the money.
 *
 * `POST /api/tasks/create` already debited a buyer's wallet and held the reward
 * pool against the task, but every rule around it was a literal in that file:
 * hardcoded task types, Zod ceilings, no floor, no KYC gate, and **no platform
 * fee at all** — a buyer paid exactly the point value of the rewards and the
 * platform earned nothing on the transaction it exists to intermediate.
 *
 * Two properties matter more than the rest and are asserted directly, because
 * they are the ones a later edit would quietly drop:
 *
 *  1. **One quote.** The invoice the buyer reads and the amount the server
 *     debits come from the same `quoteTask`. Two implementations drift by a
 *     rounding step and the buyer reads that as being overcharged.
 *  2. **A rejected task refunds the fee.** Keeping a commission on a task you
 *     refused is the fastest way to lose the buyer, and it is a default, not an
 *     accident — `buyer.refund_fee_on_reject` can turn it off deliberately.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-buyer-funding.ts
 */

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

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

const CREATE = "src/app/api/tasks/create/route.ts";
const REVIEW = "src/app/api/admin/tasks/[id]/review/route.ts";
const VIEW = "src/components/user/tasks/create-task-view.tsx";
const FORM = "src/components/admin/settings/system-settings-form.tsx";

async function main() {
  console.log("\n=== Buyer task funding ===\n");

  /* ── 1. Pricing is computed once ── */
  console.log("1. One quote, two readers");
  {
    const create = read(CREATE);
    const view = read(VIEW);
    check(
      "the server prices the charge with quoteTask",
      /quoteTask\(/.test(create)
    );
    check(
      "the buyer's invoice uses the same function",
      /quoteTask\(/.test(view) &&
        /from "@\/lib\/buyer-quote"/.test(view)
    );
    check(
      "the server does not recompute the total by hand",
      !/const costUsd = budgetPoints \/ pointsPerUsd/.test(create)
    );
    check(
      // Matched as import STATEMENTS: the doc comment says the words
      // "server-only" and "prisma" while explaining why neither is imported.
      "buyer-quote.ts is client-safe (no server-only, no prisma)",
      !/^import .*(server-only|@\/lib\/prisma)/m.test(
        read("src/lib/buyer-quote.ts")
      )
    );

    // The arithmetic itself.
    const q = quoteTask({
      pointsPerCompletion: 50,
      completions: 100,
      pointsPerUsd: 1000,
      feePercent: 10,
    });
    check("100 x 50 pts = 5,000 pts of rewards", q.budgetPoints === 5000);
    check("…which is $5 at 1000 pts/$", q.rewardUsd === 5);
    check("…plus a 10% fee of $0.50", q.feeUsd === 0.5);
    check("…charged as $5.50", q.totalUsd === 5.5);

    const free = quoteTask({
      pointsPerCompletion: 50,
      completions: 100,
      pointsPerUsd: 1000,
      feePercent: 0,
    });
    check(
      "a 0% fee charges exactly the reward pool (today's behaviour)",
      free.totalUsd === free.rewardUsd && free.feeUsd === 0
    );
    check(
      "a negative fee cannot make a task cheaper than its rewards",
      quoteTask({
        pointsPerCompletion: 10,
        completions: 10,
        pointsPerUsd: 1000,
        feePercent: -50,
      }).feeUsd === 0
    );
    check(
      "a zero points-per-USD rate does not divide by zero",
      Number.isFinite(
        quoteTask({
          pointsPerCompletion: 10,
          completions: 10,
          pointsPerUsd: 0,
          feePercent: 0,
        }).rewardUsd
      )
    );
  }

  /* ── 2. Every admin rule is actually enforced ── */
  console.log("\n2. The admin settings gate the API");
  {
    const create = read(CREATE);
    // Order matters: turning buyer funding off has to close the API even for
    // accounts that already hold the `createTasks` grant.
    const masterAt = create.indexOf("!buyer.enabled");
    const featureAt = create.indexOf('userCanFeature(userId, "createTasks")');
    check(
      "the master switch is checked BEFORE the per-user feature",
      masterAt > -1 && featureAt > -1 && masterAt < featureAt,
      `master@${masterAt} feature@${featureAt}`
    );
    check("allowed task types are enforced", /buyer\.allowedTaskTypes\.includes/.test(create));
    check("the minimum reward is enforced", /buyer\.minPointsPerTask/.test(create));
    check("the maximum reward is enforced", /buyer\.maxPointsPerTask/.test(create));
    check("the completion cap is enforced", /buyer\.maxCompletions/.test(create));
    check("the KYC gate is enforced", /buyer\.requireKyc/.test(create));
    check(
      "auto-approve decides the task's starting status",
      /buyer\.autoApproveTasks \? "ACTIVE" : "PENDING_REVIEW"/.test(create)
    );
    check(
      "the KYC gate runs before the wallet is debited",
      create.indexOf("buyer.requireKyc") < create.indexOf("cashBalance: { decrement")
    );
  }

  /* ── 3. The fee is visible revenue, not a hidden markup ── */
  console.log("\n3. The fee is its own ledger row");
  {
    const create = read(CREATE);
    check(
      "the reward pool and the fee are separate transactions",
      /reference: `task_fund_\$\{created\.id\}`/.test(create) &&
        /reference: `task_fee_\$\{created\.id\}`/.test(create)
    );
    check(
      "the budget row carries the reward only, not the total",
      /amount: -quote\.rewardUsd/.test(create)
    );
    check(
      "no fee row is written when the fee is zero",
      /if \(quote\.feeUsd > 0\)/.test(create)
    );
    const sources = read("src/lib/tx-sources.ts");
    check(
      "task fees are their own revenue source, not lumped into 'admin'",
      /"taskfee"/.test(sources) &&
        /task_fee_/.test(sources)
    );
    check(
      "ADMIN_FEE still counts as platform revenue",
      /case "ADMIN_FEE":\s*\n\s*return "revenue";/.test(
        read("src/lib/finance/signing.ts")
      )
    );
  }

  /* ── 4. Rejection makes the buyer whole ── */
  console.log("\n4. A rejected task refunds what was paid");
  {
    const review = read(REVIEW);
    check("the remaining budget is refunded", /budgetRefundUsd/.test(review));
    check("the platform fee is refunded too", /feeRefundUsd/.test(review));
    check(
      "the refund is the SUM of both",
      /const refundUsd = budgetRefundUsd \+ feeRefundUsd/.test(review)
    );
    check(
      "the fee refunded is the fee actually PAID, not today's rate",
      /reference: `task_fee_\$\{task\.id\}`/.test(review) &&
        !/feePercent \* /.test(review)
    );
    check(
      "refunding the fee also reverses the revenue row",
      /task_fee_refund_/.test(review)
    );
    check(
      "the admin can choose to keep the fee instead",
      /buyer\.refundFeeOnReject/.test(review)
    );
  }

  /* ── 5. The buyer is told the price before committing ── */
  console.log("\n5. The invoice is shown before the charge");
  {
    const view = read(VIEW);
    check("the reward pool is a line item", /Reward pool/.test(view));
    check("the fee is a line item when there is one", /Platform fee \(\{feePercent\}%\)/.test(view));
    check("the total says it hits the wallet", /Charged to your wallet/.test(view));
    check(
      "admin bounds are shown before submit, not as a server error",
      /limitError/.test(view) && /disabled=\{busy \|\| !!limitError\}/.test(view)
    );
    check(
      "the type picker only offers types the admin allows",
      /\.filter\(\(opt\) => allowedTypes\.includes\(opt\.value\)\)/.test(view)
    );
    check(
      "the page refuses to render the form when buyer funding is off",
      /!buyer\.enabled \|\| buyer\.allowedTaskTypes\.length === 0/.test(
        read("src/app/(main)/create-task/page.tsx")
      )
    );
  }

  /* ── 6. Every setting has a control ── */
  console.log("\n6. All of it is admin-configurable");
  {
    const form = read(FORM);
    for (const key of [
      "buyer.enabled",
      "buyer.fee_percent",
      "buyer.min_points_per_task",
      "buyer.max_points_per_task",
      "buyer.max_completions",
      "buyer.allowed_task_types",
      "buyer.require_kyc",
      "buyer.auto_approve_tasks",
      "buyer.refund_fee_on_reject",
    ]) {
      // The tick-box group wraps its `set(` call across lines, so a plain
      // `includes('set("key"')` misses it. Whitespace-tolerant, no regex
      // escaping needed.
      check(
        `${key} has a control`,
        form.replace(/\s+/g, "").includes(`set("${key}"`)
      );
    }
    check(
      "the client and server share one list of buyer task types",
      /from "@\/lib\/buyer-task-types"/.test(form) &&
        /from "@\/lib\/buyer-task-types"/.test(read("src/lib/buyer-settings.ts"))
    );
  }

  /* ── 7. Live data is consistent ── */
  console.log("\n7. Live state");
  {
    const funded = await prisma.task.findMany({
      where: { fundedByUserId: { not: null } },
      select: {
        id: true,
        title: true,
        status: true,
        budgetPoints: true,
        remainingBudget: true,
      },
    });
    console.log(`   ${funded.length} buyer-funded task(s)`);
    check(
      "no task has more budget left than it was funded with",
      funded.every((t) => t.remainingBudget <= t.budgetPoints),
      funded
        .filter((t) => t.remainingBudget > t.budgetPoints)
        .map((t) => t.id)
        .join(", ")
    );
    check(
      "no funded task has a negative remaining pool",
      funded.every((t) => t.remainingBudget >= 0)
    );
    check(
      "every rejected buyer task has released its pool",
      funded
        .filter((t) => t.status === "REJECTED")
        .every((t) => t.remainingBudget === 0)
    );

    // A fee row must never outlive its refund.
    const feeRows = await prisma.transaction.findMany({
      where: { reference: { startsWith: "task_fee_" } },
      select: { reference: true, amount: true },
    });
    const charges = feeRows.filter((r) => !r.reference!.startsWith("task_fee_refund_"));
    console.log(`   ${charges.length} platform fee charge(s) recorded`);
    check(
      "every recorded fee charge is a debit on the payer",
      charges.every((r) => Number(r.amount) <= 0)
    );
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
