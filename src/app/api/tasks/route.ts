import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType } from "@/generated/prisma";
import { getEffectivePackage, packageHasFeature } from "@/lib/packages";

import type { PackageFeatureKey } from "@/lib/packages";

// Map TaskType → per-type feature flag on Package. CUSTOM falls under the
// generic `tasks` flag since it has no dedicated toggle.
const TASK_TYPE_FEATURE: Record<TaskType, PackageFeatureKey> = {
  SOCIAL: "socialTasks",
  PROXY: "proxyTasks",
  ARTICLE: "articleTasks",
  VIDEO: "videoTasks",
  QUIZ: "quizTasks",
  SURVEY: "surveyTasks",
  OFFERWALL: "offerwallTasks",
  CUSTOM: "tasks",
  APPINSTALL: "appInstall",
};

// GET /api/tasks - Fetch available tasks for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TaskType | null;
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get user with their level + country
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        level: true,
        country: true,
        pointsBalance: true,
        xp: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve the user's effective plan — handles expiry + isDefault fallback.
    const userPackage = await getEffectivePackage(session.user.id);

    // Tasks-section gate. If admin disabled tasks for this plan, return empty.
    if (!packageHasFeature(userPackage, "tasks")) {
      return NextResponse.json({
        tasks: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        user: {
          level: user.level,
          packageName: userPackage?.name ?? null,
          accessLevel: userPackage?.accessLevel ?? 0,
          pointsBalance: user.pointsBalance,
          xp: user.xp,
        },
        reason: "tasks_disabled_for_plan",
      });
    }

    const accessLevel = userPackage?.accessLevel ?? 0;

    // Get user's completed tasks today for daily limit check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const userSubmissionsToday = await prisma.taskSubmission.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED", "PENDING"] },
      },
      select: { taskId: true, status: true, submittedAt: true },
    });

    // Per-task per-user status for the list badges:
    //   COMPLETED   — an APPROVED/AUTO_APPROVED submission today
    //   SUBMITTED   — a PENDING submission the user already submitted (pending review)
    //   IN_PROGRESS — a PENDING submission started but not yet submitted
    type UserTaskStatus = "COMPLETED" | "SUBMITTED" | "IN_PROGRESS";
    const userTodayCounts = new Map<string, number>();
    const pendingTaskIds = new Set<string>();
    const userStatusByTask = new Map<string, UserTaskStatus>();
    const rank: Record<UserTaskStatus, number> = {
      IN_PROGRESS: 1,
      SUBMITTED: 2,
      COMPLETED: 3,
    };
    for (const s of userSubmissionsToday) {
      userTodayCounts.set(s.taskId, (userTodayCounts.get(s.taskId) ?? 0) + 1);
      if (s.status === "PENDING") pendingTaskIds.add(s.taskId);
      const st: UserTaskStatus =
        s.status === "PENDING"
          ? s.submittedAt
            ? "SUBMITTED"
            : "IN_PROGRESS"
          : "COMPLETED";
      const prev = userStatusByTask.get(s.taskId);
      if (!prev || rank[st] > rank[prev]) userStatusByTask.set(s.taskId, st);
    }

    // Hide entire task types that this plan has switched off (e.g. plan with
    // articleTasksEnabled=false should never see ARTICLE tasks in the list).
    const allowedTypes = (Object.keys(TASK_TYPE_FEATURE) as TaskType[]).filter(
      (t) => packageHasFeature(userPackage, TASK_TYPE_FEATURE[t])
    );

    const andClauses: Array<Record<string, unknown>> = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
      { minLevel: { lte: user.level } },
      { requiredAccessLevel: { lte: accessLevel } },
      { type: { in: allowedTypes } },
    ];

    if (user.country) {
      andClauses.push({
        OR: [
          { countries: { isEmpty: true } },
          { countries: { has: user.country } },
        ],
      });
    }

    const where: Record<string, unknown> = {
      status: TaskStatus.ACTIVE,
      AND: andClauses,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.categories = {
        some: { name: category },
      };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    const taskIds = tasks.map((t) => t.id);
    const taskCategories = await prisma.taskCategory.findMany({
      where: {
        tasks: { some: { id: { in: taskIds } } },
      },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        tasks: { where: { id: { in: taskIds } }, select: { id: true } },
      },
    });

    const taskCategoryMap = new Map<string, Array<{ id: string; name: string; icon: string | null; color: string | null }>>();
    taskCategories.forEach((cat) => {
      cat.tasks.forEach((task) => {
        const existing = taskCategoryMap.get(task.id) || [];
        existing.push({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color });
        taskCategoryMap.set(task.id, existing);
      });
    });

    const submissionCounts = await Promise.all(
      taskIds.map((id) =>
        prisma.taskSubmission.count({ where: { taskId: id } })
      )
    );
    const submissionCountMap = new Map(taskIds.map((id, idx) => [id, submissionCounts[idx]]));

    const processedTasks = tasks.map((task) => {
      const todayCount = userTodayCounts.get(task.id) ?? 0;
      const hasPending = pendingTaskIds.has(task.id);
      const dailyLimit = task.dailyLimit ?? 1;
      const dailyLimitReached = todayCount >= dailyLimit;

      const reachedTotalLimit =
        task.totalLimit && task.completedCount >= task.totalLimit;

      const canStart =
        hasPending || (!dailyLimitReached && !reachedTotalLimit);

      const completedToday = !canStart;

      const remainingToday = Math.max(0, dailyLimit - todayCount);
      const remainingSlots = task.totalLimit
        ? task.totalLimit - task.completedCount
        : null;

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        pointsReward: task.pointsReward,
        xpReward: task.xpReward,
        thumbnailUrl: task.thumbnailUrl,
        duration: task.duration,
        instructions: task.instructions,
        instructionVideoUrl: task.instructionVideoUrl,
        contentUrl: task.contentUrl,
        videoConfig: task.videoConfig,
        minLevel: task.minLevel,
        requiredAccessLevel: task.requiredAccessLevel,
        categories: taskCategoryMap.get(task.id) || [],
        socialPlatform: task.socialPlatform,
        socialAction: task.socialAction,
        autoApprove: task.autoApprove,
        expiresAt: task.expiresAt,
        completedCount: submissionCountMap.get(task.id) || 0,
        remainingSlots,
        dailyLimit,
        remainingToday,
        hasPending,
        userStatus: userStatusByTask.get(task.id) ?? "AVAILABLE",
        dailyLimitReached,
        totalLimitReached: !!reachedTotalLimit,
        canStart,
        completedToday,
        reason: !canStart
          ? dailyLimitReached
            ? "Daily limit reached"
            : reachedTotalLimit
              ? "Task limit reached"
              : null
          : null,
      };
    });

    // Show startable tasks (available / in-progress / submitted) AND tasks the
    // user has completed today (so they see a "Done" badge instead of the task
    // silently vanishing). Only globally-unavailable tasks stay hidden.
    const visibleTasks = processedTasks.filter(
      (t) => t.canStart || t.userStatus === "COMPLETED"
    );

    return NextResponse.json({
      tasks: visibleTasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      user: {
        level: user.level,
        packageName: userPackage?.name ?? null,
        accessLevel,
        pointsBalance: user.pointsBalance,
        xp: user.xp,
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
