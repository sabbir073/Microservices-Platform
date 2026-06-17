import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/courses/:id/bookmark — toggle wishlist
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const course = await prisma.course.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.courseBookmark.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      select: { id: true },
    });
    if (existing) {
      await prisma.courseBookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false });
    }
    await prisma.courseBookmark.create({
      data: { userId: session.user.id, courseId: course.id },
    });
    return NextResponse.json({ bookmarked: true });
  } catch (error) {
    console.error("Bookmark toggle failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
