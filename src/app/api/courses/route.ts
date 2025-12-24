import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CourseStatus } from "@/generated/prisma";

// GET /api/courses - List available courses
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build query
    const where: Record<string, unknown> = {
      status: CourseStatus.PUBLISHED,
    };

    if (category) {
      where.category = category;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get courses
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          _count: {
            select: { lessons: true, enrollments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    // Get user's enrollments if authenticated
    let userEnrollments: Record<string, { progress: number; completedAt: Date | null }> = {};

    if (session?.user?.id) {
      const enrollments = await prisma.courseEnrollment.findMany({
        where: {
          userId: session.user.id,
          courseId: { in: courses.map((c) => c.id) },
        },
        select: {
          courseId: true,
          progress: true,
          completedAt: true,
        },
      });

      enrollments.forEach((e) => {
        userEnrollments[e.courseId] = {
          progress: e.progress,
          completedAt: e.completedAt,
        };
      });
    }

    // Format courses
    const formattedCourses = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnail,
      category: course.category,
      difficulty: course.difficulty,
      duration: course.totalDuration,
      lessonsCount: course.totalLessons,
      enrollmentsCount: course.enrollmentCount,
      price: course.price,
      isFree: course.isFree,
      rating: course.rating,
      isEnrolled: !!userEnrollments[course.id],
      progress: userEnrollments[course.id]?.progress || 0,
      isCompleted: !!userEnrollments[course.id]?.completedAt,
    }));

    // Get unique categories
    const allCourses = await prisma.course.findMany({
      where: { status: CourseStatus.PUBLISHED },
      select: { category: true },
    });

    const categoryCount = allCourses.reduce((acc: Record<string, number>, course) => {
      acc[course.category] = (acc[course.category] || 0) + 1;
      return acc;
    }, {});

    const categoryList = Object.entries(categoryCount).map(([name, count]) => ({
      name,
      count,
    }));

    return NextResponse.json({
      courses: formattedCourses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      categories: categoryList,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
