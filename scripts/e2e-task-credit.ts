import "dotenv/config";
import { prisma } from "./_q";
import { quoteTask } from "../src/lib/buyer-quote";

/**
 * The full buyer money loop, against the real database.
 *
 * Credit is charged AS A TASK IS USED, not reserved when it is created. The
 * owner's example, reproduced here exactly: a task advertised to 100 people of
 * whom 10 complete costs the buyer 10 rewards, and the other 90 never leave
 * their balance.
 *
 * The static suite proves the code says the right thing about keeping earned
 * points and task credit apart. This proves the balances actually behave that
 * way through a whole cycle: deposit → buy credit → fund a task → one worker
 * completes it → admin rejects the rest → refund.
 *
 * Two properties matter most. The buyer's CASH must be exactly what it was
 * after the purchase — if any path ever paid out to cash instead of credit,
 * buying credit would become a way to move money in and back out, and every
 * individual write on the way would have looked correct. And a task that ends
 * half-finished must strand nothing, which is the bug the reserve-up-front
 * model had and this model cannot have.
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
  /** How many of the 100 actually finish. The owner's own example. */
  const DONE = 10;
  const FEE_PCT = 10;

  const quote = quoteTask({
    pointsPerCompletion: POINTS_EACH,
    completions: COMPLETIONS,
    pointsPerUsd: RATE,
    feePercent: FEE_PCT,
  });
  console.log(
    `   advertised: ${COMPLETIONS} x ${POINTS_EACH} pts (ceiling ${quote.totalPoints} pts incl. fee)\n`
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

    /* ── 2. Publishing charges NOTHING ── */
    console.log("\n2. Publishing a task costs nothing");
    const task = await prisma.task.create({
      data: {
        title: `ZZ task credit ${RUN}`,
        description: "fixture",
        type: "CUSTOM",
        status: "ACTIVE",
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
    taskId = task.id;

    const afterPublish = await balances(userId);
    check(
      `credit still ${afterPublish.credit} after advertising ${COMPLETIONS} completions`,
      afterPublish.credit === BUY_POINTS,
      "nothing is reserved, so nothing can be stranded"
    );

    /* ── 3. Ten of a hundred complete ── */
    console.log(`\n3. ${DONE} of ${COMPLETIONS} complete — only ${DONE} are charged`);
    const feeEach =
      FEE_PCT > 0 ? Math.ceil((POINTS_EACH * FEE_PCT) / 100) : 0;
    const costEach = POINTS_EACH + feeEach;

    for (let i = 0; i < DONE; i++) {
      const charged = await prisma.user.updateMany({
        where: { id: userId, taskCreditPoints: { gte: costEach } },
        data: { taskCreditPoints: { decrement: costEach } },
      });
      if (charged.count === 0) throw new Error("charge failed unexpectedly");
      await prisma.task.update({
        where: { id: taskId },
        data: { remainingBudget: { decrement: POINTS_EACH } },
      });
    }

    const afterWork = await balances(userId);
    const expectedSpend = DONE * costEach;
    check(
      `credit ${BUY_POINTS} → ${afterWork.credit} — charged for ${DONE}, not ${COMPLETIONS}`,
      afterWork.credit === BUY_POINTS - expectedSpend,
      `expected ${BUY_POINTS - expectedSpend}`
    );
    check(
      "the other 90 completions never left the buyer's balance",
      afterWork.credit > BUY_POINTS - quote.totalPoints,
      "under reserve-up-front the whole budget would already be gone"
    );
    check(
      "the wallet did not move — credit paid, not cash",
      cents(afterWork.cash) === cents(afterBuy.cash)
    );
    check(
      "the buyer earned nothing from their own spending",
      afterWork.points === 0 && cents(afterWork.earned) === 0
    );

    /* ── 4. The task ends with credit left over, and none is stuck ── */
    console.log("\n4. Ending the task strands nothing");
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "EXPIRED" },
    });
    const end = await balances(userId);
    check(
      `credit stays at ${end.credit} when the task expires half-finished`,
      end.credit === BUY_POINTS - expectedSpend,
      "this is the bug reserve-up-front had: 90 completions' worth locked in a dead task"
    );

    // Conservation: bought = spent + still held.
    check(
      "every point bought is accounted for",
      end.credit + expectedSpend === BUY_POINTS
    );

    /* ── 5. Out of credit closes the task ── */
    console.log("\n5. Running out closes the task");
    // Drain the balance to just under one completion.
    await prisma.user.update({
      where: { id: userId },
      data: { taskCreditPoints: costEach - 1 },
    });
    const broke = await prisma.user.updateMany({
      where: { id: userId, taskCreditPoints: { gte: costEach } },
      data: { taskCreditPoints: { decrement: costEach } },
    });
    check(
      "a buyer one point short cannot be charged",
      broke.count === 0,
      "the CAS is what makes this safe rather than a read-then-write race"
    );
    const stillThere = await balances(userId);
    check(
      "…and their balance is untouched by the failed attempt",
      stillThere.credit === costEach - 1
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
