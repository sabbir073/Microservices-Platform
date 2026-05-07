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
      instructionVideoUrl,
      type,
      status,
      pointsReward,
      xpReward,
      dailyLimit,
      totalLimit,
      minLevel,
      requiredAccessLevel,
      countries,
      contentUrl,
      thumbnailUrl,
      duration,
      questions,
      socialPlatform,
      socialAction,
      socialUrl,
      socialConfig,
      articleConfig,
      videoConfig,
      surveyConfig,
      proxyInstructions,
      startsAt,
      expiresAt,
      cooldownMinutes,
      autoApprove,
      boardId,
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

    // Validate boardId references an existing active board, if provided
    if (boardId) {
      const board = await prisma.taskBoard.findUnique({
        where: { id: boardId },
        select: { id: true, isActive: true },
      });
      if (!board || !board.isActive) {
        return NextResponse.json(
          { error: "Selected Task Board not found or inactive" },
          { status: 400 }
        );
      }
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        instructions: instructions || null,
        instructionVideoUrl: instructionVideoUrl || null,
        type,
        status: status || "ACTIVE",
        pointsReward: parseInt(pointsReward.toString()),
        xpReward: parseInt(xpReward?.toString() || "0"),
        dailyLimit: dailyLimit ? parseInt(dailyLimit.toString()) : null,
        totalLimit: totalLimit ? parseInt(totalLimit.toString()) : null,
        minLevel: parseInt(minLevel?.toString() || "1"),
        requiredAccessLevel:
          typeof requiredAccessLevel === "number"
            ? requiredAccessLevel
            : parseInt(String(requiredAccessLevel ?? 0)) || 0,
        countries: countries || [],
        contentUrl: contentUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration ? parseInt(duration.toString()) : null,
        questions: questions || null,
        socialPlatform: socialPlatform || null,
        socialAction: socialAction || null,
        socialUrl: socialUrl || null,
        socialConfig: socialConfig
          ? JSON.parse(JSON.stringify(socialConfig))
          : null,
        articleConfig: articleConfig
          ? JSON.parse(JSON.stringify(articleConfig))
          : null,
        videoConfig: videoConfig
          ? JSON.parse(JSON.stringify(videoConfig))
          : null,
        surveyConfig: surveyConfig
          ? JSON.parse(JSON.stringify(surveyConfig))
          : null,
        proxyInstructions: proxyInstructions || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        cooldownMinutes: parseInt(cooldownMinutes?.toString() || "0"),
        autoApprove: autoApprove || false,
        boardId: boardId || null,
        createdById: session.user.id,
        // Surveys: always manual review, once-per-user. These overrides win.
        ...(type === "SURVEY"
          ? { autoApprove: false, dailyLimit: 1, totalLimit: 1 }
          : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TASK_CREATED",
        entity: "Task",
        entityId: task.id,
        newData: { type, title, pointsReward: task.pointsReward },
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
