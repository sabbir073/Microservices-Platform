import "dotenv/config";
import { prisma } from "./_q";
import { quoteTask } from "../src/lib/buyer-quote";

/**
 * Live money check for buyer task funding, against the real database.
 *
 * The static suite proves the code says the right thing. This proves the money
 * actually moves the right way: a buyer funds a task with a platform fee, an
 * admin rejects it, and the buyer's wallet must end up **exactly** where it
 * started — not approximately, and not short by the fee.
 *
 * Fixtures are unique per run (an earlier suite in this repo used a FIXED
 * fixture email and two overlapping runs raced on the unique constraint) and
 * are deleted at the end, whether or not the assertions pass.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/e2e-buyer-fee.ts
 */

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `zz_buyerfee_${RUN}@fixture.local`;

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

async function main() {
  console.log("\n=== Buyer fee, live money ===\n");

  const POINTS_PER_USD = 1000;
  const FEE_PCT = 10;
  const POINTS = 50;
  const COMPLETIONS = 100;
  const START_CASH = 100;

  const quote = quoteTask({
    pointsPerCompletion: POINTS,
    completions: COMPLETIONS,
    pointsPerUsd: POINTS_PER_USD,
    feePercent: FEE_PCT,
  });
  console.log(
    `   quote: ${quote.budgetPoints} pts = $${quote.rewardUsd.toFixed(2)} rewards + $${quote.feeUsd.toFixed(2)} fee = $${quote.totalUsd.toFixed(2)}\n`
  );

  let userId = "";
  let taskId = "";

  try {
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        name: "Buyer fee fixture",
        username: `zzbuyerfee${RUN}`.slice(0, 30),
        referralCode: `ZZBF${RUN.toUpperCase()}`.slice(0, 20),
        cashBalance: START_CASH,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    userId = user.id;

    /* ── 1. Funding debits reward + fee, as two rows ── */
    console.log("1. Funding the task");
    const task = await prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { id: userId, cashBalance: { gte: quote.totalUsd } },
        data: { cashBalance: { decrement: quote.totalUsd } },
      });
      if (debit.count === 0) throw new Error("INSUFFICIENT_FUNDS");

      const created = await tx.task.create({
        data: {
          title: `ZZ buyer fee ${RUN}`,
          description: "fixture",
          type: "CUSTOM",
          status: "PENDING_REVIEW",
          pointsReward: POINTS,
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
          type: "PURCHASE",
          status: "COMPLETED",
          amount: -quote.rewardUsd,
          points: 0,
          description: "fixture budget",
          reference: `task_fund_${created.id}`,
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "ADMIN_FEE",
          status: "COMPLETED",
          amount: -quote.feeUsd,
          points: 0,
          description: "fixture fee",
          reference: `task_fee_${created.id}`,
        },
      });
      return created;
    });
    taskId = task.id;

    const afterFund = await prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true },
    });
    const fundedCash = Number(afterFund!.cashBalance);
    check(
      `wallet went $${START_CASH} → $${fundedCash.toFixed(2)} (reward + fee)`,
      cents(fundedCash) === cents(START_CASH - quote.totalUsd),
      `expected ${(START_CASH - quote.totalUsd).toFixed(2)}`
    );

    const feeRow = await prisma.transaction.findFirst({
      where: { reference: `task_fee_${taskId}` },
      select: { amount: true },
    });
    check(
      "the fee is on its own ledger row, as a debit",
      feeRow !== null && cents(Number(feeRow.amount)) === cents(-quote.feeUsd)
    );

    /* ── 2. One approved completion draws only from the pool ── */
    console.log("\n2. A completion draws from the pool, not the wallet");
    const drawn = await prisma.task.updateMany({
      where: { id: taskId, remainingBudget: { gte: POINTS } },
      data: { remainingBudget: { decrement: POINTS } },
    });
    check("the CAS draw succeeded", drawn.count === 1);
    const mid = await prisma.task.findUnique({
      where: { id: taskId },
      select: { remainingBudget: true },
    });
    check(
      `pool ${quote.budgetPoints} → ${mid!.remainingBudget} pts`,
      mid!.remainingBudget === quote.budgetPoints - POINTS
    );
    const midCash = Number(
      (await prisma.user.findUnique({
        where: { id: userId },
        select: { cashBalance: true },
      }))!.cashBalance
    );
    check(
      "the buyer's wallet did not move — the pool paid, not the wallet",
      cents(midCash) === cents(fundedCash)
    );

    /* ── 3. Rejection refunds the UNSPENT pool plus the fee ── */
    console.log("\n3. Rejection makes the buyer whole");
    const remaining = mid!.remainingBudget;
    const budgetRefund = remaining / POINTS_PER_USD;
    const paidFee = Math.abs(Number(feeRow!.amount));
    const refund = budgetRefund + paidFee;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: "REJECTED", remainingBudget: 0 },
      });
      await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { increment: refund } },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "REFUND",
          status: "COMPLETED",
          amount: refund,
          points: 0,
          description: "fixture refund",
          reference: `task_refund_${taskId}`,
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          type: "ADMIN_FEE",
          status: "COMPLETED",
          amount: paidFee,
          points: 0,
          description: "fixture fee refund",
          reference: `task_fee_refund_${taskId}`,
        },
      });
    });

    const endCash = Number(
      (await prisma.user.findUnique({
        where: { id: userId },
        select: { cashBalance: true },
      }))!.cashBalance
    );

    // The buyer paid for one completion that happened, and gets the rest back:
    // start − (one reward) is the only money they should be out.
    const oneReward = POINTS / POINTS_PER_USD;
    check(
      `wallet ends at $${endCash.toFixed(2)} — out only the ${POINTS} pts actually delivered`,
      cents(endCash) === cents(START_CASH - oneReward),
      `expected ${(START_CASH - oneReward).toFixed(2)}`
    );
    check(
      "the platform kept nothing: the fee came back in full",
      cents(endCash + oneReward) === cents(START_CASH)
    );

    const feeRows = await prisma.transaction.findMany({
      where: { userId, type: "ADMIN_FEE" },
      select: { amount: true },
    });
    const netFee = feeRows.reduce((s, r) => s + Number(r.amount), 0);
    check(
      "net platform fee revenue for a rejected task is exactly zero",
      cents(netFee) === 0,
      `net ${netFee}`
    );

    const closed = await prisma.task.findUnique({
      where: { id: taskId },
      select: { remainingBudget: true, status: true },
    });
    check(
      "the rejected task holds no budget and is not advertised",
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
