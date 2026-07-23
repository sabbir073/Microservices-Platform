import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userCanFeature } from "@/lib/packages";

// PATCH /api/agency/reports/[id] — an agency moderator resolves a report.
// Allowed actions (limited — no ban/suspend/hard-delete; those stay admin-only):
//   dismiss  → mark resolved, no content change
//   hide     → soft-hide the reported post/comment (isHidden = true)
//   escalate → raise priority to URGENT so an admin picks it up
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!(await userCanFeature(userId, "agencyMode"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const note = String(body.note ?? "").trim().slice(0, 500) || null;

  const report = await prisma.socialReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (!["POST", "COMMENT"].includes(report.contentType)) {
    return NextResponse.json({ error: "Not moderatable here" }, { status: 400 });
  }

  if (action === "escalate") {
    await prisma.socialReport.update({
      where: { id },
      data: { priority: "URGENT", resolverNote: note },
    });
    return NextResponse.json({ success: true, escalated: true });
  }

  if (action === "hide") {
    if (report.contentType === "POST") {
      await prisma.post.update({ where: { id: report.contentId }, data: { isHidden: true } }).catch(() => {});
    } else {
      await prisma.comment.update({ where: { id: report.contentId }, data: { isHidden: true } }).catch(() => {});
    }
    await prisma.socialReport.update({
      where: { id },
      data: { status: "RESOLVED", resolution: "HIDDEN", resolvedById: userId, resolvedAt: new Date(), resolverNote: note },
    });
    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "AGENCY_HIDE",
          entity: report.contentType,
          entityId: report.contentId,
          newData: { reportId: id, note },
        },
      })
      .catch(() => {});
    return NextResponse.json({ success: true, hidden: true });
  }

  // Default: dismiss.
  await prisma.socialReport.update({
    where: { id },
    data: { status: "RESOLVED", resolution: "DISMISSED", resolvedById: userId, resolvedAt: new Date(), resolverNote: note },
  });
  return NextResponse.json({ success: true, dismissed: true });
}
