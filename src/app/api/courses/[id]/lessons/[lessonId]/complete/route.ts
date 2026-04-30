import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: courseId, lessonId } = await params;
  const userId = session.user.id;

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
  });
  if (!lesson || lesson.courseId !== courseId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  // Get or create enrollment
  const enrollment = await prisma.courseEnrollment.upsert({
    where: { courseId_userId: { courseId, userId } },
    create: {
      courseId,
      userId,
      completedLessons: [lessonId],
      progress: 0,
    },
    update: {},
  });

  // Add lesson to completed set if not already
  const completedSet = new Set(enrollment.completedLessons);
  if (!completedSet.has(lessonId)) {
    completedSet.add(lessonId);

    const totalLessons = await prisma.courseLesson.count({
      where: { courseId },
    });
    const progress = Math.round((completedSet.size / totalLessons) * 100);
    const isComplete = progress === 100;

    await prisma.courseEnrollment.update({
      where: { courseId_userId: { courseId, userId } },
      data: {
        completedLessons: Array.from(completedSet),
        progress,
        ...(isComplete && !enrollment.completedAt
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  return NextResponse.json({ success: true });
}
