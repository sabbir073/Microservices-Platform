import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { readBuyerReport } from "@/lib/buyer-reports";

/**
 * Closing a buyer's report on a completion.
 *
 * The buyer can flag one completion and say why (see
 * `/api/tasks/mine/[id]/submissions` POST). This is the other end: an admin
 * agrees or does not, and the queue on /admin/buyers empties.
 *
 * **No money moves here, and that is not an omission.** An approved submission
 * is final everywhere else in the platform — there is no un-approve path, by
 * design, because a worker who was told they were paid must stay paid. Upholding
 * a report is a finding about the WORK, and what it buys is the record: the
 * worker's activity feed carries it, and repeat offenders are dealt with on the
 * account, which is where fraud is actually stopped. A buyer who expects a
 * refund from this is being told, in the UI, that they will not get one.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Judging a submission is a submission permission, not a buyer one: this is
  // the same call an admin makes in the review queue, reached from a different
  // page.
  if (!(await can(session.user.id, "submissions.reject"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const submissionId = String(body.submissionId ?? "");
  const outcome = String(body.outcome ?? "").toUpperCase();
  const note = String(body.note ?? "").trim().slice(0, 500);
  if (!submissionId || (outcome !== "UPHELD" && outcome !== "DISMISSED")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const sub = (await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, taskId: true, metadata: true },
  })) as unknown as {
    id: string;
    userId: string;
    taskId: string;
    metadata: unknown;
  } | null;
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const report = readBuyerReport(sub.metadata);
  if (!report) {
    return NextResponse.json({ error: "No report on this" }, { status: 404 });
  }
  if (report.status !== "OPEN") {
    return NextResponse.json(
      { error: `Already ${report.status.toLowerCase()}.` },
      { status: 409 }
    );
  }

  const existing =
    sub.metadata && typeof sub.metadata === "object"
      ? (sub.metadata as Record<string, unknown>)
      : {};
  // Merge: `metadata` holds the SOCIAL proof bag, and replacing it wholesale
  // would erase the evidence the report is about.
  await prisma.taskSubmission.update({
    where: { id: sub.id },
    data: {
      metadata: {
        ...existing,
        buyerReport: {
          ...report,
          status: outcome,
          resolvedAt: new Date().toISOString(),
          resolvedBy: session.user.id,
          note: note || undefined,
        },
      } as never,
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action:
      outcome === "UPHELD" ? "BUYER_REPORT_UPHELD" : "BUYER_REPORT_DISMISSED",
    entity: "TaskSubmission",
    entityId: sub.id,
    // The worker it was about — so an upheld report shows on the account it
    // concerns, which is the only place it can be acted on.
    targetUserId: sub.userId,
    summary:
      outcome === "UPHELD"
        ? "Upheld a buyer's report on a completion"
        : "Dismissed a buyer's report on a completion",
    meta: { taskId: sub.taskId, reason: report.reason, note },
  });

  return NextResponse.json({ ok: true, status: outcome });
}
