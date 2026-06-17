import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";
import { NotificationType } from "@/generated/prisma";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  body: z.string().min(10).max(2000),
});

// POST /api/tutor/courses/:id/announcements
// Tutor posts an announcement → row stored + every enrolled student gets a
// Notification of type COURSE.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role as UserRole | undefined;
    if (!hasPermission(role, "tutor.courses.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, title: true, tutorId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (course.tutorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const v = createSchema.safeParse(body);
    if (!v.success) {
      return NextResponse.json(
        { error: "Invalid input", details: v.error.issues },
        { status: 400 }
      );
    }

    const announcement = await prisma.courseAnnouncement.create({
      data: {
        courseId: course.id,
        authorId: session.user.id,
        title: v.data.title,
        body: v.data.body,
      },
    });

    // Fan-out notifications to enrolled students
    const enrolled = await prisma.courseEnrollment.findMany({
      where: { courseId: course.id },
      select: { userId: true },
    });
    if (enrolled.length > 0) {
      await prisma.notification.createMany({
        data: enrolled.map((e) => ({
          userId: e.userId,
          type: NotificationType.COURSE,
          title: `📢 ${v.data.title}`,
          message: `${course.title}: ${v.data.body.slice(0, 200)}`,
          data: { courseId: course.id, announcementId: announcement.id },
        })),
      });
    }

    return NextResponse.json({
      announcement,
      notifiedCount: enrolled.length,
    });
  } catch (error) {
    console.error("Post announcement failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
