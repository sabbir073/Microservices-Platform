import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { usd } from "@/lib/utils";
import { notifyUser } from "@/lib/notify";
import { getPointsPerUsd } from "@/lib/economy";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { toNum } from "@/lib/money";
import { TransactionType, TransactionStatus, NotificationType } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/tasks/[id]/review — approve or reject a user-submitted
// (PENDING_REVIEW) task. Rejecting refunds the creator's remaining budget.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user || !(await can(session.user.id, "tasks.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      fundedByUserId: true,
      remainingBudget: true,
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "This task is not awaiting review." },
      { status: 400 }
    );
  }

  // A rejection without a reason is one the buyer cannot act on: they paid for
  // this, and "rejected" alone tells them nothing to change. Required on the
  // server too, so it holds for any caller, not just the admin UI.
  if (action === "reject" && reason.length < 5) {
    return NextResponse.json(
      { error: "Give the buyer a reason — they see it in their Buyer Hub." },
      { status: 400 }
    );
  }

  if (action === "approve") {
    await prisma.task.update({ where: { id }, data: { status: "ACTIVE" } });
    if (task.fundedByUserId) {
      await notifyUser({
        userId: task.fundedByUserId,
        type: NotificationType.SYSTEM,
        title: "Task approved ✅",
        message: `Your task "${task.title}" is approved and now live.`,
        link: "/create-task",
      }).catch(() => {});
    }
    await writeAudit({
      actorId: session.user.id,
      action: "TASK_REVIEWED",
      entity: "Task",
      entityId: id,
      targetUserId: task.fundedByUserId ?? null,
      summary: `Approved "${task.title}" — now live`,
      meta: { decision: "approve", title: task.title },
    });
    return NextResponse.json({ success: true, status: "ACTIVE" });
  }

  // Reject -> refund the remaining budget to the creator's wallet.
  const pointsPerUsd = await getPointsPerUsd();
  const budgetRefundUsd =
    task.fundedByUserId && task.remainingBudget > 0
      ? task.remainingBudget / pointsPerUsd
      : 0;

  // ...and the platform fee they paid to submit it, unless the admin has
  // chosen to keep it as a review charge. Charging a buyer a commission for a
  // task you then refuse is the fastest way to lose the buyer, so the setting
  // defaults to refunding. The fee is found on its own ledger row rather than
  // recomputed from the current fee percent — the rate may have changed since
  // they paid, and they are owed what they actually paid.
  const buyer = await getBuyerSettings();
  let feeRefundUsd = 0;
  if (task.fundedByUserId && buyer.refundFeeOnReject) {
    const feeRow = await prisma.transaction.findFirst({
      where: {
        userId: task.fundedByUserId,
        reference: `task_fee_${task.id}`,
      },
      select: { amount: true },
    });
    // The fee was written as a negative charge on the payer.
    feeRefundUsd = feeRow ? Math.abs(toNum(feeRow.amount)) : 0;
  }
  const refundUsd = budgetRefundUsd + feeRefundUsd;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: { status: "REJECTED", remainingBudget: 0, rejectionReason: reason },
    });
    if (task.fundedByUserId && refundUsd > 0) {
      await tx.user.update({
        where: { id: task.fundedByUserId },
        data: { cashBalance: { increment: refundUsd } },
      });
      await tx.transaction.create({
        data: {
          userId: task.fundedByUserId,
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED,
          amount: refundUsd,
          points: 0,
          description: `Task budget refund — "${task.title}"`,
          reference: `task_refund_${task.id}`,
          metadata: {
            taskId: task.id,
            kind: "task_refund",
            budgetRefundUsd,
            feeRefundUsd,
          },
        },
      });
      // Reverse the revenue row as well, so the finance console does not keep
      // reporting a fee the platform gave back as income.
      if (feeRefundUsd > 0) {
        await tx.transaction.create({
          data: {
            userId: task.fundedByUserId,
            type: TransactionType.ADMIN_FEE,
            status: TransactionStatus.COMPLETED,
            amount: feeRefundUsd,
            points: 0,
            description: `Platform fee refunded — "${task.title}"`,
            reference: `task_fee_refund_${task.id}`,
            metadata: { taskId: task.id, kind: "task_fee_refund" },
          },
        });
      }
    }
  });

  if (task.fundedByUserId) {
    await notifyUser({
      userId: task.fundedByUserId,
      type: NotificationType.SYSTEM,
      title: "Task rejected",
      message: `Your task "${task.title}" was rejected${reason ? `: ${reason}` : ""}. ${usd(refundUsd)} was refunded to your wallet${feeRefundUsd > 0 ? " (budget + platform fee)" : ""}.`,
      link: "/create-task",
    }).catch(() => {});
  }
  await writeAudit({
    actorId: session.user.id,
    action: "TASK_REVIEWED",
    entity: "Task",
    entityId: id,
    targetUserId: task.fundedByUserId ?? null,
    summary: `Rejected "${task.title}"${reason ? ` — ${reason}` : ""} · refunded ${usd(refundUsd)}`,
    meta: { decision: "reject", reason: reason ?? null, refundUsd, title: task.title },
  });
  return NextResponse.json({ success: true, status: "REJECTED", refundUsd });
}
