import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { BoardsClient } from "@/components/admin/boards/boards-client";

export default async function TaskBoardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "boards.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "boards.manage");
  const boards = await prisma.taskBoard.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  const ids = boards.map((b) => b.id);
  const taskCounts = await Promise.all(
    ids.map((id) => prisma.task.count({ where: { boardId: id } }))
  );
  const countByBoard = new Map(ids.map((id, i) => [id, taskCounts[i] ?? 0]));

  const enriched = boards.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    iconEmoji: b.iconEmoji,
    pointsReward: b.pointsReward,
    xpReward: b.xpReward,
    isActive: b.isActive,
    order: b.order,
    taskCount: countByBoard.get(b.id) ?? 0,
  }));

  return <BoardsClient initialBoards={enriched} canManage={canManage} />;
}
