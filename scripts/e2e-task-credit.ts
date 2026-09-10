import "dotenv/config";
import { prisma } from "./_q";
import { quoteTask } from "../src/lib/buyer-quote";

/**
 * The full buyer money loop, against the real database.
 *
 * The static suite proves the code says the right thing about keeping earned
 * points and task credit apart. This proves the balances actually behave that
 * way through a whole cycle: deposit → buy credit → fund a task → one worker
 * completes it → admin rejects the rest → refund.
 *
 * The assertion that matters most is the last one: after all of that, the
 * buyer's CASH is exactly what it was after the purchase. If a single refund
 * path ever paid out to cash instead of credit, buying credit would become a
 * way to move money in and back out, and every individual write on the way
 * would have looked correct.
 *
 * Fixtures are unique per run and removed at the end either way.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/e2e-task-credit.ts
 */

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `zz_taskcredit_${RUN}@fixture.local`;

let passed = 0;
const failures: string[] = [];
const cents = (n: number) => Math.round(n * 100);

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function balances(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cashBalance: true,
      pointsBalance: true,
      taskCreditPoints: true,
      totalEarnings: true,
    },
  });
  return {
    cash: Number(u!.cashBalance),
    points: u!.pointsBalance,
    credit: u!.taskCreditPoints,
    earned: Number(u!.totalEarnings),
  };
}

async function main() {
  console.log("\n=== Task credit, live money loop ===\n");

  const RATE = 1000; // points per $1
  const START_CASH = 100;
  const BUY_POINTS = 20_000;
  const POINTS_EACH = 50;
  const COMPLETIONS = 100;
  const FEE_PCT = 10;

  const quote = quoteTask({
    pointsPerCompletion: POINTS_EACH,
    completions: COMPLETIONS,
    pointsPerUsd: RATE,
    feePercent: FEE_PCT,
  });
  console.log(
    `   task: ${quote.budgetPoints} pts rewards + ${quote.feePoints} pts fee = ${quote.totalPoints} pts\n`
  );

  let userId = "";
  let taskId = "";

  try {
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        name: "Task credit fixture",
        username: `zztc${RUN}`.slice(0, 30),
        referralCode: `ZZTC${RUN.toUpperCase()}`.slice(0, 20),
        cashBalance: START_CASH,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    userId = user.id;

    /* ── 1. Buy credit ── */
    console.log("1. Cash buys task credit");
    const costUsd = BUY_POINTS / RATE;
    await prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: userId, cashBalance: { gte: costUsd } },
        data: {
          cashBalance: { decrement: costUsd },
          taskCreditPoints: { increment: BUY_POINTS },
        },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_CASH");
      await tx.transaction.create({
        data: {
          userId,
          type: "PURCHASE",
          status: "COMPLETED",
          amount: -costUsd,
          points: BUY_POINTS,
          description: "fixture credit purchase",
          reference: `taskcredit_buy_${userId}_${Date.now()}`,
        },
      });
    });

    const afterBuy = await balances(userId);
    check(
      `wallet $${START_CASH} → $${afterBuy.cash.toFixed(2)}, credit 0 → ${afterBuy.credit}`,
      cents(afterBuy.cash) === cents(START_CASH - costUsd) &&
        afterBuy.credit === BUY_POINTS
    );
    check(
      "buying credit did NOT touch the earned-points balance",
      afterBuy.points === 0
    );
    check(
      "…and did not inflate lifetime earnings",
      cents(afterBuy.earned) === 0,
      "buying is not earning"
    );

    /* ── 2. Fund a task from credit ── */
    console.log("\n2. The task is funded from credit, not cash");
    const task = await prisma.$transaction(async (tx) => {
      const paid = await tx.user.updateMany({
        where: { id: userId, taskCreditPoints: { gte: quote.totalPoints } },
        data: { taskCreditPoints: { decrement: quote.totalPoints } },
      });
      if (paid.count === 0) throw new Error("INSUFFICIENT_CREDIT");
      const created = await tx.task.create({
        data: {
          title: `ZZ task credit ${RUN}`,
          description: "fixture",
          type: "CUSTOM",
          status: "PENDING_REVIEW",
          pointsReward: POINTS_EACH,
          xpReward: 0,
          totalLimit: COMPLETIONS,
          createdById: userId,
          fundedByUserId: userId,
          budgetPoints: quote.budgetPoints,
          remainingBudget: quote.budgetPoints,
        },
        select: { id: true },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "ADMIN_FEE",
          status: "COMPLETED",
          amount: -quote.feeUsd,
          points: -quote.feePoints,
          description: "fixture fee",
          reference: `task_fee_${created.id}`,
        },
      });
      return created;
    });
    taskId = task.id;

    const afterFund = await balances(userId);
    check(
      `credit ${BUY_POINTS} → ${afterFund.credit} (rewards + fee)`,
      afterFund.credit === BUY_POINTS - quote.totalPoints
    );
    check(
      "the wallet did not move — credit paid, not cash",
      cents(afterFund.cash) === cents(afterBuy.cash)
    );

    /* ── 3. A worker completes one ── */
    console.log("\n3. A completion pays the WORKER's earned points");
    const drawn = await prisma.task.updateMany({
      where: { id: taskId, remainingBudget: { gte: POINTS_EACH } },
      data: { remainingBudget: { decrement: POINTS_EACH } },
    });
    check("the pool CAS draw succeeded", drawn.count === 1);
    const mid = await prisma.task.findUnique({
      where: { id: taskId },
      select: { remainingBudget: true },
    });
    check(
      `pool ${quote.budgetPoints} → ${mid!.remainingBudget}`,
      mid!.remainingBudget === quote.budgetPoints - POINTS_EACH
    );
    const afterWork = await balances(userId);
    check(
      "the buyer's own credit is untouched by a completion",
      afterWork.credit === afterFund.credit,
      "the POOL pays, not the balance"
    );

    /* ── 4. Rejected → refund as credit ── */
    console.log("\n4. Rejection returns CREDIT, never cash");
    const remaining = mid!.remainingBudget;
    const refundPoints = remaining + quote.feePoints;
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: "REJECTED", remainingBudget: 0 },
      });
      await tx.user.update({
        where: { id: userId },
        data: { taskCreditPoints: { increment: refundPoints } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "REFUND",
          status: "COMPLETED",
          amount: 0,
          points: refundPoints,
          description: "fixture refund",
          reference: `taskcredit_refund_${taskId}`,
        },
      });
      // Reversing the revenue row is what stops the finance console reporting
      // a commission the platform gave back as income.
      await tx.transaction.create({
        data: {
          userId,
          type: "ADMIN_FEE",
          status: "COMPLETED",
          amount: quote.feeUsd,
          points: quote.feePoints,
          description: "fixture fee refund",
          reference: `task_fee_refund_${taskId}`,
        },
      });
    });

    const end = await balances(userId);

    // THE assertion. Everything above moved money around inside the platform;
    // none of it may have leaked back into withdrawable cash.
    check(
      `wallet is still $${end.cash.toFixed(2)} — nothing leaked back to cash`,
      cents(end.cash) === cents(afterBuy.cash),
      `expected ${afterBuy.cash.toFixed(2)}`
    );
    check(
      "the buyer never earned points from their own spending",
      end.points === 0 && cents(end.earned) === 0
    );
    check(
      `credit ends at ${end.credit} — out only the ${POINTS_EACH} pts delivered`,
      end.credit === BUY_POINTS - POINTS_EACH,
      `expected ${BUY_POINTS - POINTS_EACH}`
    );

    // Conservation: bought = held + delivered.
    check(
      "every point bought is accounted for",
      end.credit + POINTS_EACH === BUY_POINTS
    );

    // Carried over from the retired cash-era e2e: the platform must keep
    // nothing on a task it refused.
    const feeRows = await prisma.transaction.findMany({
      where: { userId, type: "ADMIN_FEE" },
      select: { amount: true, points: true },
    });
    const netFeeUsd = feeRows.reduce((s, r) => s + Number(r.amount), 0);
    const netFeePoints = feeRows.reduce((s, r) => s + (r.points ?? 0), 0);
    check(
      "net platform fee on a rejected task is exactly zero, in both units",
      cents(netFeeUsd) === 0 && netFeePoints === 0,
      `usd=${netFeeUsd} points=${netFeePoints}`
    );

    const closed = await prisma.task.findUnique({
      where: { id: taskId },
      select: { remainingBudget: true, status: true },
    });
    check(
      "the rejected task holds no pool and is not advertised",
      closed!.remainingBudget === 0 && closed!.status === "REJECTED"
    );
  } finally {
    if (taskId) {
      await prisma.transaction
        .deleteMany({ where: { reference: { contains: taskId } } })
        .catch(() => {});
      await prisma.task.delete({ where: { id: taskId } }).catch(() => {});
    }
    if (userId) {
      await prisma.transaction.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    console.log("\nfixtures cleaned");
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
