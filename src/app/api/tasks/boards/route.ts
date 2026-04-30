import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await prisma.taskBoard.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  // Count tasks per board + active participants (rough)
  const boardIds = boards.map((b) => b.id);
  const taskCounts = await Promise.all(
    boardIds.map((id) =>
      prisma.task.count({ where: { boardId: id, status: "ACTIVE" } })
    )
  );

  return NextResponse.json({
    boards: boards.map((b, i) => ({
      id: b.id,
      name: b.title,
      description: b.description,
      thumbnailUrl: null,
      taskCount: taskCounts[i] ?? 0,
      totalRewardPts: b.pointsReward,
      participants: 0,
      expiresAt: undefined,
    })),
  });
}
