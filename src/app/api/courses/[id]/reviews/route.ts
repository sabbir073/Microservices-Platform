import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
});

// GET /api/courses/:id/reviews — paginated
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const take = Math.min(50, Math.max(1, Number(searchParams.get("take") ?? 20)));
    const skip = Math.max(0, Number(searchParams.get("skip") ?? 0));

    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [rowsRaw, total] = await Promise.all([
      prisma.courseReview.findMany({
        where: { courseId: course.id },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.courseReview.count({ where: { courseId: course.id } }),
    ]);
    return NextResponse.json({ rows: rowsRaw, total });
  } catch (error) {
    console.error("List reviews failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/courses/:id/reviews — create or update (one per user per course)
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
    const v = reviewSchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json(
        { error: "Invalid input", details: v.error.issues },
        { status: 400 }
      );
    }
    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, totalReviews: true, totalRatings: true, avgRating: true, tutorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Must be enrolled to review
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json(
        { error: "You must be enrolled to review this course." },
        { status: 403 }
      );
    }

    await prisma.courseReview.upsert({
      where: { courseId_userId: { courseId: course.id, userId: session.user.id } },
      create: {
        courseId: course.id,
        userId: session.user.id,
        rating: v.data.rating,
        title: v.data.title ?? null,
        comment: v.data.comment ?? null,
      },
      update: {
        rating: v.data.rating,
        title: v.data.title ?? null,
        comment: v.data.comment ?? null,
      },
    });

    // Recompute course rating aggregates
    const agg = await prisma.courseReview.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.course.update({
      where: { id: course.id },
      data: {
        avgRating: agg._avg.rating ?? 0,
        rating: agg._avg.rating ?? 0,
        totalRatings: agg._count._all,
        totalReviews: agg._count._all,
      },
    });

    // Tutor profile aggregate refresh
    if (course.tutorId) {
      const tutorAgg = await prisma.courseReview.aggregate({
        where: { course: { tutorId: course.tutorId } },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await prisma.tutorProfile.updateMany({
        where: { userId: course.tutorId },
        data: {
          avgRating: tutorAgg._avg.rating ?? 0,
          totalRatings: tutorAgg._count._all,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Post review failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
