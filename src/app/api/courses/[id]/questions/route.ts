import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NotificationType } from "@/generated/prisma";

const askSchema = z.object({
  question: z.string().min(10).max(2000),
  lessonId: z.string().optional().nullable(),
});

// GET /api/courses/:id/questions — paginated Q&A
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const take = Math.min(50, Math.max(1, Number(searchParams.get("take") ?? 30)));
    const skip = Math.max(0, Number(searchParams.get("skip") ?? 0));

    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await prisma.courseQuestion.findMany({
      where: { courseId: course.id },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take,
      skip,
      include: {
        asker: { select: { id: true, name: true, avatar: true } },
        answeredBy: { select: { id: true, name: true, avatar: true } },
      },
    });
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("List questions failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/courses/:id/questions — enrolled student asks; tutor gets a notification
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const v = askSchema.safeParse(body);
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
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      select: { id: true },
    });
    if (!enrolled) {
      return NextResponse.json(
        { error: "Enrol in this course before posting a question." },
        { status: 403 }
      );
    }

    const q = await prisma.courseQuestion.create({
      data: {
        courseId: course.id,
        askerId: session.user.id,
        question: v.data.question.trim(),
        lessonId: v.data.lessonId ?? null,
      },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: { totalQuestions: { increment: 1 } },
    });
    if (course.tutorId) {
      await prisma.notification.create({
        data: {
          userId: course.tutorId,
          type: NotificationType.COURSE,
          title: "New question from a student",
          message: `${v.data.question.slice(0, 200)}`,
          data: { courseId: course.id, questionId: q.id },
        },
      });
    }
    return NextResponse.json({ question: q });
  } catch (error) {
    console.error("Ask question failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
