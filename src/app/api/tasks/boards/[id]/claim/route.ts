import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  TaskStatus,
  SubmissionStatus,
  TransactionType,
  TransactionStatus,
  NotificationType,
} from "@/generated/prisma/client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const board = await prisma.taskBoard.findUnique({ where: { id } });
  if (!board || !board.isActive) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const reference = `board_claim_${board.id}`;
  const existing = await prisma.transaction.findFirst({
    where: { userId, reference },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Reward already claimed for this board" },
      { status: 400 }
    );
  }

  const tasks = await prisma.task.findMany({
    where: { boardId: board.id, status: TaskStatus.ACTIVE },
    select: { id: true },
  });
  if (tasks.length === 0) {
    return NextResponse.json({ error: "Board has no active tasks" }, { status: 400 });
  }

  const completedCount = await prisma.taskSubmission.count({
    where: {
      userId,
      taskId: { in: tasks.map((t) => t.id) },
      status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.AUTO_APPROVED] },
    },
  });

  if (completedCount < tasks.length) {
    return NextResponse.json(
      {
        error: `Complete all ${tasks.length} tasks first (${completedCount} done).`,
      },
      { status: 400 }
    );
  }

  const points = board.pointsReward ?? 0;
  const xp = board.xpReward ?? 0;

  const [, , tx] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: points },
        xp: { increment: xp },
        totalEarnings: { increment: points / 1000 },
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: "Board Completed!",
        message: `You earned ${points} pts and ${xp} XP from "${board.title}"`,
        data: { boardId: board.id, points, xp },
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        points,
        amount: points / 1000,
        description: `Board reward: ${board.title}`,
        reference,
        metadata: { boardId: board.id, xp },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    points,
    xp,
    transactionId: tx.id,
  });
}
