import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { courseWriteSchema, saveCourse } from "@/lib/course-write";

// GET /api/tutor/courses — only courses owned by the current tutor
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role as UserRole | undefined;
    if (!hasPermission(role, "tutor.courses.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";

    const where: Record<string, unknown> = { tutorId: session.user.id };
    if (status) where.status = status;

    const rows = await prisma.course.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { lessons: true, enrollments: true, reviews: true } },
      },
    });
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("List tutor courses failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/tutor/courses — tutor creates a new course (owned by them)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role as UserRole | undefined;
    if (!hasPermission(role, "tutor.courses.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Defensive: make sure they actually have a TutorProfile row.
    // Admins editing as themselves don't, but admins should use /api/admin/courses.
    const profile = await prisma.tutorProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      return NextResponse.json(
        {
          error:
            "No tutor profile found. Apply via /profile/become-tutor first, or ask an admin to grant you tutor status.",
        },
        { status: 403 }
      );
    }
    if (profile.isSuspended) {
      return NextResponse.json(
        { error: "Your tutor account is suspended. Contact an admin." },
        { status: 403 }
      );
    }
    const body = await req.json();
    const v = courseWriteSchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json(
        { error: "Invalid input", details: v.error.issues },
        { status: 400 }
      );
    }
    const course = await saveCourse(v.data, {
      actor: "tutor",
      userId: session.user.id,
    });

    // Update tutor profile counter
    await prisma.tutorProfile.update({
      where: { userId: session.user.id },
      data: { totalCourses: { increment: 1 } },
    });

    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error) {
    console.error("Create tutor course failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
