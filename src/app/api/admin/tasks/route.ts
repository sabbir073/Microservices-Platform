import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const {
      title,
      description,
      instructions,
      type,
      status,
      pointsReward,
      xpReward,
      dailyLimit,
      totalLimit,
      minLevel,
      requiredPackage,
      countries,
      contentUrl,
      thumbnailUrl,
      duration,
      questions,
      socialPlatform,
      socialAction,
      socialUrl,
      proxyInstructions,
      startsAt,
      expiresAt,
      cooldownMinutes,
      autoApprove,
    } = body;

    // Validate required fields
    if (!title || !description || !type || pointsReward === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: title, description, type, and pointsReward are required" },
        { status: 400 }
      );
    }

    // Validate task type
    const validTypes = ["VIDEO", "ARTICLE", "QUIZ", "SURVEY", "SOCIAL", "PROXY", "OFFERWALL", "CUSTOM"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        instructions: instructions || null,
        type,
        status: status || "ACTIVE",
        pointsReward: parseInt(pointsReward.toString()),
        xpReward: parseInt(xpReward?.toString() || "0"),
        dailyLimit: dailyLimit ? parseInt(dailyLimit.toString()) : null,
        totalLimit: totalLimit ? parseInt(totalLimit.toString()) : null,
        minLevel: parseInt(minLevel?.toString() || "1"),
        requiredPackage: requiredPackage || "FREE",
        countries: countries || [],
        contentUrl: contentUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration ? parseInt(duration.toString()) : null,
        questions: questions || null,
        socialPlatform: socialPlatform || null,
        socialAction: socialAction || null,
        socialUrl: socialUrl || null,
        proxyInstructions: proxyInstructions || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        cooldownMinutes: parseInt(cooldownMinutes?.toString() || "0"),
        autoApprove: autoApprove || false,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (type && type !== "all") {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { submissions: true },
          },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      tasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
