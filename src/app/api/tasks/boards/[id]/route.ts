import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, SubmissionStatus } from "@/generated/prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const board = await prisma.taskBoard.findUnique({ where: { id } });
  if (!board || !board.isActive) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { boardId: id, status: TaskStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
  });

  const taskIds = tasks.map((t) => t.id);
  const submissions = taskIds.length
    ? await prisma.taskSubmission.findMany({
        where: {
          userId: session.user.id,
          taskId: { in: taskIds },
          status: {
            in: [
              SubmissionStatus.APPROVED,
              SubmissionStatus.AUTO_APPROVED,
              SubmissionStatus.PENDING,
            ],
          },
        },
        select: { taskId: true, status: true },
      })
    : [];

  const statusByTask = new Map(submissions.map((s) => [s.taskId, s.status]));

  const enriched = tasks.map((t) => {
    const sub = statusByTask.get(t.id);
    let userStatus: "DONE" | "PENDING" | "AVAILABLE" = "AVAILABLE";
    if (sub === SubmissionStatus.APPROVED || sub === SubmissionStatus.AUTO_APPROVED) {
      userStatus = "DONE";
    } else if (sub === SubmissionStatus.PENDING) {
      userStatus = "PENDING";
    }
    return {
      id: t.id,
      title: t.title,
      type: t.type,
      pointsReward: t.pointsReward,
      xpReward: t.xpReward,
      duration: t.duration,
      thumbnailUrl: t.thumbnailUrl,
      userStatus,
    };
  });

  const doneCount = enriched.filter((t) => t.userStatus === "DONE").length;
  const allDone = enriched.length > 0 && doneCount === enriched.length;

  // Was the board reward already claimed?
  const claim = await prisma.transaction.findFirst({
    where: {
      userId: session.user.id,
      reference: `board_claim_${board.id}`,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    board: {
      id: board.id,
      title: board.title,
      description: board.description,
      iconEmoji: board.iconEmoji,
      pointsReward: board.pointsReward,
      xpReward: board.xpReward,
    },
    tasks: enriched,
    progress: {
      done: doneCount,
      total: enriched.length,
      allDone,
    },
    claimedAt: claim?.createdAt ?? null,
  });
}
