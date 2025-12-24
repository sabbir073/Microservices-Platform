import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType, PackageTier } from "@/generated/prisma";

// Package tier order for comparison
const PACKAGE_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
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
      select: { taskId: true },
    });

    const completedTaskIdsToday = userSubmissionsToday.map((s) => s.taskId);

    // Build task query
    const where: Record<string, unknown> = {
      status: TaskStatus.ACTIVE,
      // Check if task hasn't expired
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      // Check if task has started
      AND: [
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
      ],
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

    // Country filter - if task has countries restriction, user must be in one of them
    // If task has empty countries array, it's available globally
    if (user.country) {
      where.OR = [
        { countries: { isEmpty: true } },
        { countries: { has: user.country } },
      ];
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
      // Check if user has already completed this task today
      const completedToday = completedTaskIdsToday.includes(task.id);

      // Check if task has reached total limit
      const reachedTotalLimit =
        task.totalLimit && task.completedCount >= task.totalLimit;

      // Check if user can do this task
      const canStart = !completedToday && !reachedTotalLimit;

      // Calculate remaining slots
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
        minLevel: task.minLevel,
        requiredPackage: task.requiredPackage,
        categories: taskCategoryMap.get(task.id) || [],
        socialPlatform: task.socialPlatform,
        socialAction: task.socialAction,
        autoApprove: task.autoApprove,
        expiresAt: task.expiresAt,
        completedCount: submissionCountMap.get(task.id) || 0,
        remainingSlots,
        canStart,
        completedToday,
        reason: !canStart
          ? completedToday
            ? "Already completed today"
            : reachedTotalLimit
              ? "Task limit reached"
              : null
          : null,
      };
    });

    return NextResponse.json({
      tasks: processedTasks,
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
