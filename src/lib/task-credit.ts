import "server-only";
import { prisma } from "@/lib/prisma";
import { getPointsPerUsd } from "@/lib/economy";
import { TransactionType, TransactionStatus } from "@/generated/prisma/client";
import type { LedgerDb } from "@/lib/ledger";

/**
 * Task credit — points bought to fund tasks, kept strictly apart from points
 * earned.
 *
 * The separation is the whole point of this module, so it is worth stating why
 * rather than leaving it to be rediscovered:
 *
 * `User.pointsBalance` is what a worker EARNS. It mirrors into `totalEarnings`,
 * it converts to cash (`points-convert.ts`), and cash can be withdrawn. If task
 * budgets came out of that same column, then buying points would be buying
 * withdrawable balance — money in, money straight back out, with a completed
 * "task" as the paperwork. That is a laundering path and a chargeback one at
 * the same time.
 *
 * So `taskCreditPoints` has exactly one way in and one way out:
 *   IN  — `purchaseTaskCredit`, paid for with wallet cash.
 *   OUT — `spendTaskCredit`, funding a task (plus `refundTaskCredit` when the
 *         admin rejects it).
 *
 * Nothing that credits earnings may write it, it is never converted to cash,
 * and it is never withdrawn. `scripts/verify-task-credit.ts` asserts all of
 * that from both directions, because the invariant is only worth as much as
 * what stops the next edit breaking it.
 */

/** Ledger reference prefixes, so the finance console can tell these apart. */
export const TASK_CREDIT_PURCHASE_REF = "taskcredit_buy_";
export const TASK_CREDIT_REFUND_REF = "taskcredit_refund_";

export type PurchaseResult =
  | { ok: true; points: number; costUsd: number; newBalance: number }
  | { ok: false; reason: "INSUFFICIENT_CASH" | "TOO_SMALL" | "TOO_LARGE"; shortByUsd?: number };

/**
 * Buy task credit with wallet cash.
 *
 * Atomic and no-overdraft: the cash debit is a CAS (`cashBalance >= cost`), so
 * two concurrent purchases cannot both pass on the same balance. The credit and
 * the ledger row are written in the same transaction, so a crash cannot leave
 * the user charged with nothing to show for it.
 */
export async function purchaseTaskCredit(
  userId: string,
  points: number,
  opts: { minPoints: number; maxPoints: number }
): Promise<PurchaseResult> {
  const amount = Math.floor(points);
  if (!Number.isFinite(amount) || amount < opts.minPoints) {
    return { ok: false, reason: "TOO_SMALL" };
  }
  if (amount > opts.maxPoints) return { ok: false, reason: "TOO_LARGE" };

  const rate = await getPointsPerUsd();
  const costUsd = amount / rate;

  try {
    return await prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: userId, cashBalance: { gte: costUsd } },
        data: {
          cashBalance: { decrement: costUsd },
          taskCreditPoints: { increment: amount },
        },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_CASH");

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.PURCHASE,
          status: TransactionStatus.COMPLETED,
          amount: -costUsd,
          // `points` records what was bought. It is NOT an earning: the row is
          // a PURCHASE, and nothing reads it as income.
          points: amount,
          description: `Task credit — ${amount.toLocaleString()} points`,
          reference: `${TASK_CREDIT_PURCHASE_REF}${userId}_${Date.now()}`,
          metadata: { kind: "task_credit_purchase", points: amount, rate },
        },
      });

      const after = await tx.user.findUnique({
        where: { id: userId },
        select: { taskCreditPoints: true },
      });
      return {
        ok: true as const,
        points: amount,
        costUsd,
        newBalance: after?.taskCreditPoints ?? 0,
      };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CASH") {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { cashBalance: true },
      });
      const have = Number(me?.cashBalance ?? 0);
      return {
        ok: false,
        reason: "INSUFFICIENT_CASH",
        shortByUsd: Math.max(0, costUsd - have),
      };
    }
    throw e;
  }
}

/**
 * Spend task credit — the only way points leave this balance.
 *
 * A CAS decrement, so a buyer cannot fund two tasks with the same points by
 * firing both requests at once. Takes a transaction client because the caller
 * creates the task in the same transaction: the spend and the thing it paid
 * for must commit together or not at all.
 *
 * Returns false when the balance could not cover it; the caller aborts.
 */
export async function spendTaskCredit(
  db: LedgerDb,
  userId: string,
  points: number
): Promise<boolean> {
  const amount = Math.floor(points);
  if (amount <= 0) return true;
  const spent = await db.user.updateMany({
    where: { id: userId, taskCreditPoints: { gte: amount } },
    data: { taskCreditPoints: { decrement: amount } },
  });
  return spent.count > 0;
}

/**
 * Return task credit to the buyer — a rejected task, or an unspent pool.
 *
 * Goes back as CREDIT, never as cash. Refunding to `cashBalance` would let a
 * buyer launder task credit into withdrawable money by funding a task and
 * getting it rejected, which is the exact hole the separate column exists to
 * close.
 */
export async function refundTaskCredit(
  db: LedgerDb,
  userId: string,
  points: number,
  reason: { taskId: string; kind: string }
): Promise<void> {
  const amount = Math.floor(points);
  if (amount <= 0) return;

  await db.user.update({
    where: { id: userId },
    data: { taskCreditPoints: { increment: amount } },
  });
  await db.transaction.create({
    data: {
      userId,
      type: TransactionType.REFUND,
      status: TransactionStatus.COMPLETED,
      // No USD moved: the credit never left the platform, so recording a dollar
      // amount here would overstate refunds in the finance console.
      amount: 0,
      points: amount,
      description: `Task credit returned — ${amount.toLocaleString()} points`,
      reference: `${TASK_CREDIT_REFUND_REF}${reason.taskId}`,
      metadata: { kind: reason.kind, taskId: reason.taskId, points: amount },
    },
  });
}

/** Current task-credit balance. */
export async function getTaskCredit(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { taskCreditPoints: true },
  });
  return u?.taskCreditPoints ?? 0;
}
