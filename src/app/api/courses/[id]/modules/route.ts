import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const lessons = await prisma.courseLesson.findMany({
    where: { courseId: id },
    orderBy: { order: "asc" },
  });

  // Fetch user's enrollment progress
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: {
      courseId_userId: { courseId: id, userId: session.user.id },
    },
  });
  const completed = new Set(enrollment?.completedLessons ?? []);

  // Group lessons into a single "Module" since CourseLesson schema doesn't have module nesting
  const modules = [
    {
      id: "default",
      title: course.title,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        durationMin: l.duration,
        videoUrl: l.videoUrl ?? undefined,
        content: l.content ?? undefined,
        completed: completed.has(l.id),
      })),
    },
  ];

  return NextResponse.json({ modules });
}
