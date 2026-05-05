import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType, PackageTier } from "@/generated/prisma";

// Package tier order for comparison
const PACKAGE_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  ELITE: 3,
  VIP: 4,
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

    // Get user with their package tier and level
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        level: true,
        packageTier: true,
        country: true,
        pointsBalance: true,
        xp: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's completed tasks today for daily limit check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const userSubmissionsToday = await prisma.taskSubmission.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED", "PENDING"] },
      },
      select: { taskId: true, status: true },
    });

    // Per-task counts (consume daily slot) and pending-set (in-flight,
    // user can resume regardless of limit).
    const userTodayCounts = new Map<string, number>();
    const pendingTaskIds = new Set<string>();
    for (const s of userSubmissionsToday) {
      userTodayCounts.set(s.taskId, (userTodayCounts.get(s.taskId) ?? 0) + 1);
      if (s.status === "PENDING") pendingTaskIds.add(s.taskId);
    }

    // Build task query — use AND-only structure so each constraint composes correctly.
    const andClauses: Array<Record<string, unknown>> = [
      // Not expired
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      // Already started
      { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
      // User must meet minimum level
      { minLevel: { lte: user.level } },
      // User must have required package tier
      {
        requiredPackage: {
          in: Object.entries(PACKAGE_ORDER)
            .filter(([, order]) => order <= PACKAGE_ORDER[user.packageTier])
            .map(([tier]) => tier as PackageTier),
        },
      },
    ];

    // Country filter — task must allow this user's country (or be global).
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

    // Filter by type if specified
    if (type) {
      where.type = type;
    }

    // Filter by category if specified
    if (category) {
      where.categories = {
        some: { name: category },
      };
    }

    // Fetch tasks
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    // Get categories for each task
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

    // Build task-to-categories map
    const taskCategoryMap = new Map<string, Array<{ id: string; name: string; icon: string | null; color: string | null }>>();
    taskCategories.forEach((cat) => {
      cat.tasks.forEach((task) => {
        const existing = taskCategoryMap.get(task.id) || [];
        existing.push({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color });
        taskCategoryMap.set(task.id, existing);
      });
    });

    // Get submission counts
    const submissionCounts = await Promise.all(
      taskIds.map((id) =>
        prisma.taskSubmission.count({ where: { taskId: id } })
      )
    );
    const submissionCountMap = new Map(taskIds.map((id, idx) => [id, submissionCounts[idx]]));

    // Process tasks to add eligibility and status info
    const processedTasks = tasks.map((task) => {
      const todayCount = userTodayCounts.get(task.id) ?? 0;
      const hasPending = pendingTaskIds.has(task.id);
      const dailyLimit = task.dailyLimit ?? 1;
      const dailyLimitReached = todayCount >= dailyLimit;

      // Total limit (across all users)
      const reachedTotalLimit =
        task.totalLimit && task.completedCount >= task.totalLimit;

      // User can start a fresh attempt if they haven't hit the daily/total
      // limit. If they have an in-flight PENDING they can always resume.
      const canStart =
        hasPending || (!dailyLimitReached && !reachedTotalLimit);

      // Back-compat boolean — legacy clients use it as "blocked".
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
        requiredPackage: task.requiredPackage,
        categories: taskCategoryMap.get(task.id) || [],
        socialPlatform: task.socialPlatform,
        socialAction: task.socialAction,
        autoApprove: task.autoApprove,
        expiresAt: task.expiresAt,
        completedCount: submissionCountMap.get(task.id) || 0,
        remainingSlots,
        // v3: explicit per-user limit info
        dailyLimit,
        remainingToday,
        hasPending,
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

    // Hide maxed-out tasks from the user-facing list. Tasks where the user
    // has hit their daily limit (and has no in-flight pending) are removed
    // — they should reappear tomorrow. History tabs (pending/approved/
    // rejected) are powered by /api/submissions and aren't affected.
    const visibleTasks = processedTasks.filter((t) => t.canStart);

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
        packageTier: user.packageTier,
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
