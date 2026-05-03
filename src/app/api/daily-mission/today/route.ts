import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubmissionStatus, TaskType } from "@/generated/prisma/client";

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function utcStartOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

const TASK_TYPE_VALUES = new Set(Object.values(TaskType));

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, level: true, packageTier: true },
  });
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Pick today's mission for the user's package tier — newest active that fits
  // their level, ordered by `order` then createdAt.
  const missionRaw = await prisma.dailyMissionTemplate.findFirst({
    where: {
      packageTier: me.packageTier,
      isActive: true,
      requiredLevel: { lte: me.level },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!missionRaw) {
    return NextResponse.json({ mission: null });
  }
  type ItemRow = {
    id: string;
    taskType: string;
    description: string | null;
    targetCount: number;
    xpPerComplete: number;
    pointsPerComplete: number;
    duration: number | null;
    requiredLevel: number | null;
    order: number;
  };
  const mission = missionRaw as typeof missionRaw & { items: ItemRow[] };

  const today = utcDateKey();
  const todayStart = utcStartOfDay();

  // Count submissions per task-type for the user, today, with completed status.
  const completedToday = await prisma.taskSubmission.findMany({
    where: {
      userId,
      createdAt: { gte: todayStart },
      status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.AUTO_APPROVED] },
    },
    select: { taskId: true, task: { select: { type: true, boardId: true } } },
  });
  type SubmRow = {
    taskId: string;
    task: { type: string; boardId: string | null };
  };
  const subs = completedToday as SubmRow[];

  const countByType: Record<string, number> = {};
  for (const s of subs) {
    countByType[s.task.type] = (countByType[s.task.type] ?? 0) + 1;
    if (s.task.boardId) {
      // Tasks tied to a board count for both their TaskType and BOARD bucket
      countByType.BOARD = (countByType.BOARD ?? 0) + 1;
    }
  }

  // Items + per-item progress
  const itemsWithProgress = mission.items.map((it) => {
    // For taskType not in enum (BOARD/MANUAL/CUSTOM), only BOARD has count above.
    // MANUAL & CUSTOM aren't a real TaskType → fall back to CUSTOM bucket count.
    const sourceType = TASK_TYPE_VALUES.has(it.taskType as TaskType)
      ? it.taskType
      : it.taskType === "BOARD"
      ? "BOARD"
      : it.taskType === "MANUAL"
      ? "CUSTOM"
      : it.taskType;
    const completed = countByType[sourceType] ?? 0;
    return {
      id: it.id,
      taskType: it.taskType,
      description: it.description,
      targetCount: it.targetCount,
      xpPerComplete: it.xpPerComplete,
      pointsPerComplete: it.pointsPerComplete,
      duration: it.duration,
      requiredLevel: it.requiredLevel,
      order: it.order,
      completedToday: Math.min(completed, it.targetCount),
      done: completed >= it.targetCount,
    };
  });

  const allDone = itemsWithProgress.every((it) => it.done);
  const totalItems = itemsWithProgress.length;
  const doneItems = itemsWithProgress.filter((it) => it.done).length;

  // Already claimed today?
  const claim = await prisma.dailyMissionClaim.findUnique({
    where: {
      userId_missionId_date: {
        userId,
        missionId: mission.id,
        date: today,
      },
    },
  });

  // Streak: count consecutive prior days with claims (this mission OR any).
  // Cheap approach: pull the last 30 claims for this user and walk back.
  let streak = claim?.streak ?? 0;
  if (!claim) {
    const recent = await prisma.dailyMissionClaim.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
      select: { date: true },
    });
    const seen = new Set(recent.map((r) => r.date));
    let s = 0;
    const cursor = new Date();
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    for (let i = 0; i < 30; i++) {
      const k = utcDateKey(cursor);
      if (seen.has(k)) {
        s += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    }
    streak = s;
  }

  return NextResponse.json({
    mission: {
      id: mission.id,
      name: mission.name,
      description: mission.description,
      packageTier: mission.packageTier,
      requiredLevel: mission.requiredLevel,
      completionXpReward: mission.completionXpReward,
      completionPointsReward: mission.completionPointsReward,
      linkReferralBonus: mission.linkReferralBonus,
      autoRefresh: mission.autoRefresh,
    },
    items: itemsWithProgress,
    progress: { done: doneItems, total: totalItems, allDone },
    claimedToday: !!claim,
    streak,
    today,
  });
}
