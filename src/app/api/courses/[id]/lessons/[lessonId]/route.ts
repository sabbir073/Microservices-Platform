import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CourseStatus, NotificationType } from "@/generated/prisma";

// GET /api/courses/:id/lessons/:lessonId - Get lesson content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const session = await auth();
    const { id, lessonId } = await params;

    // Get lesson with course info
    const lesson = await prisma.courseLesson.findFirst({
      where: {
        id: lessonId,
        courseId: id,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            status: true,
            totalLessons: true,
          },
        },
      },
    });

    if (!lesson || lesson.course.status !== CourseStatus.PUBLISHED) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    // Check if user is enrolled (required for non-free lessons)
    let isEnrolled = false;
    let isCompleted = false;

    if (session?.user?.id) {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: {
          courseId_userId: {
            userId: session.user.id,
            courseId: id,
          },
        },
      });

      isEnrolled = !!enrollment;
      if (enrollment) {
        isCompleted = enrollment.completedLessons.includes(lessonId);
      }
    }

    // Check if lesson is locked (not free and not enrolled)
    if (!lesson.isFree && lesson.order > 1 && !isEnrolled) {
      return NextResponse.json(
        { error: "Please enroll in this course to access this lesson" },
        { status: 403 }
      );
    }

    // Get next and previous lessons
    const [prevLesson, nextLesson] = await Promise.all([
      prisma.courseLesson.findFirst({
        where: {
          courseId: id,
          order: lesson.order - 1,
        },
        select: { id: true, title: true },
      }),
      prisma.courseLesson.findFirst({
        where: {
          courseId: id,
          order: lesson.order + 1,
        },
        select: { id: true, title: true },
      }),
    ]);

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        order: lesson.order,
        isFree: lesson.isFree,
      },
      course: {
        id: lesson.course.id,
        title: lesson.course.title,
        totalLessons: lesson.course.totalLessons,
      },
      progress: {
        isCompleted,
        isEnrolled,
      },
      navigation: {
        prev: prevLesson,
        next: nextLesson,
      },
    });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return NextResponse.json(
      { error: "Failed to fetch lesson" },
      { status: 500 }
    );
  }
}

// POST /api/courses/:id/lessons/:lessonId - Mark lesson as complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, lessonId } = await params;

    // Get enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_userId: {
          userId: session.user.id,
          courseId: id,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Please enroll in this course first" },
        { status: 403 }
      );
    }

    // Check if already completed
    if (enrollment.completedLessons.includes(lessonId)) {
      return NextResponse.json({
        message: "Lesson already completed",
        courseProgress: enrollment.progress,
        completedLessons: enrollment.completedLessons.length,
      });
    }

    // Get lesson and course info
    const lesson = await prisma.courseLesson.findFirst({
      where: {
        id: lessonId,
        courseId: id,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            totalLessons: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    // Add lesson to completed list
    const newCompletedLessons = [...enrollment.completedLessons, lessonId];
    const totalLessons = lesson.course.totalLessons || 1;
    const newProgress = Math.round((newCompletedLessons.length / totalLessons) * 100);
    const courseCompleted = newProgress >= 100 && !enrollment.completedAt;

    // Update enrollment
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: {
        completedLessons: newCompletedLessons,
        progress: Math.min(newProgress, 100),
        ...(courseCompleted && { completedAt: new Date() }),
      },
    });

    // If course completed, create notification
    if (courseCompleted) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: NotificationType.ACHIEVEMENT,
          title: "Course Completed!",
          message: `Congratulations! You've completed "${lesson.course.title}"!`,
          data: {
            courseId: id,
          },
        },
      });
    }

    return NextResponse.json({
      courseProgress: Math.min(newProgress, 100),
      completedLessons: newCompletedLessons.length,
      totalLessons,
      courseCompleted,
      message: courseCompleted
        ? "Congratulations! You've completed the course!"
        : "Lesson completed!",
    });
  } catch (error) {
    console.error("Error completing lesson:", error);
    return NextResponse.json(
      { error: "Failed to complete lesson" },
      { status: 500 }
    );
  }
}
