import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";

const lessonSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  content: z.string().optional(),
  duration: z.number().int().min(0).default(0),
  isFree: z.boolean().optional().default(false),
});

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(3),
  thumbnail: z.string().url().optional().or(z.literal("")),
  category: z.string().default("General"),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  price: z.number().min(0).default(0),
  isFree: z.boolean().default(true),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  lessons: z.array(lessonSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "courses.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }
    const data = validation.data;

    const totalDuration = data.lessons.reduce(
      (acc, l) => acc + (l.duration ?? 0),
      0
    );

    const course = await prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        thumbnail: data.thumbnail || null,
        category: data.category,
        difficulty: data.difficulty,
        price: data.price,
        isFree: data.isFree,
        status: data.status,
        totalLessons: data.lessons.length,
        totalDuration,
        createdById: session.user.id,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        lessons: {
          create: data.lessons.map((l, i) => ({
            order: i,
            title: l.title,
            description: l.description ?? null,
            videoUrl: l.videoUrl || null,
            content: l.content ?? null,
            duration: l.duration ?? 0,
            isFree: !!l.isFree,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "COURSE_CREATED",
        entity: "Course",
        entityId: course.id,
        newData: {
          title: course.title,
          lessons: data.lessons.length,
          status: data.status,
        },
      },
    });

    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}
