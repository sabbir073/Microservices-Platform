import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/courses/:id/assignments/:assignmentId
// Returns the assignment + the current user's existing submission (if any).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, assignmentId } = await params;
    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, tutorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const isOwner = course.tutorId === session.user.id;
    if (!isOwner) {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const assignmentRaw = await prisma.courseAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (
      !assignmentRaw ||
      (assignmentRaw as { courseId: string }).courseId !== course.id
    ) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }
    const submission = await prisma.courseAssignmentSubmission.findFirst({
      where: { assignmentId, userId: session.user.id },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json({
      assignment: {
        ...assignmentRaw,
        submission,
      },
    });
  } catch (error) {
    console.error("Get assignment failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
