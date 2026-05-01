import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SubmissionStatus,
  TaskType,
  TransactionType,
  TransactionStatus,
  NotificationType,
} from "@/generated/prisma/client";

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
function utcStartOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

const TASK_TYPE_VALUES = new Set(Object.values(TaskType));

export async function POST() {
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
    return NextResponse.json({ error: "No active mission for your tier" }, { status: 404 });
  }
  type ItemRow = {
    id: string;
    taskType: string;
    targetCount: number;
  };
  const mission = missionRaw as typeof missionRaw & { items: ItemRow[] };

  const today = utcDateKey();
  const todayStart = utcStartOfDay();

  // Confirm completion
  const completed = await prisma.taskSubmission.findMany({
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
  const subs = completed as SubmRow[];
  const countByType: Record<string, number> = {};
  for (const s of subs) {
    countByType[s.task.type] = (countByType[s.task.type] ?? 0) + 1;
    if (s.task.boardId) {
      countByType.BOARD = (countByType.BOARD ?? 0) + 1;
    }
  }

  for (const it of mission.items) {
    const sourceType = TASK_TYPE_VALUES.has(it.taskType as TaskType)
      ? it.taskType
      : it.taskType === "BOARD"
      ? "BOARD"
      : it.taskType === "MANUAL"
      ? "CUSTOM"
      : it.taskType;
    const got = countByType[sourceType] ?? 0;
    if (got < it.targetCount) {
      return NextResponse.json(
        {
          error: `Mission incomplete — need ${it.targetCount - got} more ${it.taskType.toLowerCase()} task${it.targetCount - got > 1 ? "s" : ""}.`,
        },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.dailyMissionClaim.findUnique({
    where: {
      userId_missionId_date: { userId, missionId: mission.id, date: today },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already claimed today's mission reward" },
      { status: 400 }
    );
  }

  // Compute streak: consecutive days ending yesterday for this user.
  const recent = await prisma.dailyMissionClaim.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true },
  });
  const seen = new Set(recent.map((r) => r.date));
  let streak = 1;
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 30; i++) {
    const k = utcDateKey(cursor);
    if (seen.has(k)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  const points = mission.completionPointsReward;
  const xp = mission.completionXpReward;

  await prisma.$transaction([
    prisma.dailyMissionClaim.create({
      data: { userId, missionId: mission.id, date: today, streak },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: points },
        xp: { increment: xp },
        totalEarnings: { increment: points / 1000 },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        points,
        amount: points / 1000,
        description: `Daily mission completed: ${mission.name}`,
        reference: `daily_mission_${mission.id}_${today}`,
        metadata: { missionId: mission.id, xp, streak, date: today },
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: "🎯 Daily Mission Complete!",
        message: `You earned ${points} pts + ${xp} XP from "${mission.name}". Streak: ${streak} day${streak === 1 ? "" : "s"}.`,
        data: { missionId: mission.id, points, xp, streak },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    points,
    xp,
    streak,
    date: today,
  });
}
