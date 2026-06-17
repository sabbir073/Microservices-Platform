import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { maybeIssueCertificate } from "@/lib/course-certificate";

const submitSchema = z.object({
  answers: z.record(z.string(), z.array(z.string())),
});

// POST /api/courses/:id/quiz/:quizId/attempts
// Grades the attempt against stored correctAnswers and saves the result.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quizId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, quizId } = await params;
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
      select: { id: true },
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
    const quizRaw = await prisma.courseQuiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          select: { id: true, correctAnswers: true, points: true },
        },
      },
    });
    if (!quizRaw || (quizRaw as { courseId: string }).courseId !== course.id) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    const quiz = quizRaw as unknown as {
      passMarkPercent: number;
      questions: Array<{ id: string; correctAnswers: unknown; points: number }>;
    };

    // Grade
    let earned = 0;
    let total = 0;
    const correctIds: string[] = [];
    for (const q of quiz.questions) {
      total += q.points;
      const correctRaw = Array.isArray(q.correctAnswers)
        ? (q.correctAnswers as string[])
        : [];
      const sent = (v.data.answers[q.id] ?? []).map((s) => s.toLowerCase().trim());
      const expected = correctRaw.map((s) => s.toLowerCase().trim());
      // Set equality for both MCQ and MULTI_SELECT
      const isRight =
        sent.length === expected.length &&
        sent.every((s) => expected.includes(s));
      if (isRight) {
        earned += q.points;
        correctIds.push(q.id);
      }
    }
    const score = total === 0 ? 0 : (earned / total) * 100;
    const passed = score >= quiz.passMarkPercent;

    const attempt = await prisma.courseQuizAttempt.create({
      data: {
        quizId,
        userId: session.user.id,
        answers: v.data.answers as unknown as object,
        score,
        passed,
        submittedAt: new Date(),
      },
    });

    // If they passed and they're enrolled, see whether this completes the
    // course's quiz-pass requirement → auto-issue certificate.
    if (passed) {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
        select: { id: true },
      });
      if (enrollment) {
        await maybeIssueCertificate(enrollment.id);
      }
    }

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        score,
        passed,
        correctIds,
      },
    });
  } catch (error) {
    console.error("Quiz submit failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
