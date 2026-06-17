import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NotificationType, AssignmentSubmissionStatus } from "@/generated/prisma";

const submitSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  fileUrls: z.array(z.string().url()).max(20).default([]),
});

// POST /api/courses/:id/assignments/:assignmentId/submit
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, assignmentId } = await params;
    const body = await req.json();
    const v = submitSchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json(
        { error: "Invalid input", details: v.error.issues },
        { status: 400 }
      );
    }
    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, title: true, tutorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }
    const assignment = await prisma.courseAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, courseId: true, title: true },
    });
    if (!assignment || assignment.courseId !== course.id) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Upsert by (assignmentId, userId) — one active submission per student
    const existing = await prisma.courseAssignmentSubmission.findFirst({
      where: { assignmentId, userId: session.user.id },
      select: { id: true },
    });
    const submission = existing
      ? await prisma.courseAssignmentSubmission.update({
          where: { id: existing.id },
          data: {
            answers: v.data.answers as unknown as object,
            fileUrls: v.data.fileUrls,
            status: AssignmentSubmissionStatus.PENDING,
            submittedAt: new Date(),
          },
        })
      : await prisma.courseAssignmentSubmission.create({
          data: {
            assignmentId,
            userId: session.user.id,
            answers: v.data.answers as unknown as object,
            fileUrls: v.data.fileUrls,
          },
        });

    // Notify the tutor
    if (course.tutorId) {
      await prisma.notification.create({
        data: {
          userId: course.tutorId,
          type: NotificationType.COURSE,
          title: "New assignment submission",
          message: `A student submitted "${assignment.title}" in "${course.title}".`,
          data: {
            courseId: course.id,
            assignmentId,
            submissionId: submission.id,
          },
        },
      });
    }
    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Submit assignment failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
