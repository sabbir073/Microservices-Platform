import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { validateCoupon } from "@/lib/course-coupon";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  code: z.string().min(1).max(60),
  courseId: z.string().min(1),
});

// POST /api/coupons/validate
// Body: { code, courseId } → { valid, discount, finalPrice }
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const v = bodySchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    // Allow courseId to be either an id or a slug for parity with /api/courses
    const course = await prisma.course.findFirst({
      where: { OR: [{ id: v.data.courseId }, { slug: v.data.courseId }] },
      select: { id: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const result = await validateCoupon({
      code: v.data.code,
      courseId: course.id,
      userId: session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Coupon validate failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
