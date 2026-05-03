import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  iconEmoji: z.string().max(8).nullable().optional(),
  pointsReward: z.number().int().min(0).optional(),
  xpReward: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "boards.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const board = await prisma.taskBoard.findUnique({ where: { id } });
  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { boardId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      pointsReward: true,
      xpReward: true,
      completedCount: true,
    },
  });

  const completedSubmissions = tasks.length
    ? await prisma.taskSubmission.count({
        where: {
          taskId: { in: tasks.map((t) => t.id) },
          status: { in: ["APPROVED", "AUTO_APPROVED"] },
        },
      })
    : 0;

  return NextResponse.json({
    board,
    tasks,
    stats: {
      taskCount: tasks.length,
      totalCompletions: completedSubmissions,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "boards.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const v = updateSchema.safeParse(body);
  if (!v.success) {
    return NextResponse.json(
      { error: "Invalid input", details: v.error.issues },
      { status: 400 }
    );
  }

  const before = await prisma.taskBoard.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const board = await prisma.taskBoard.update({
    where: { id },
    data: v.data,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BOARD_UPDATED",
      entity: "TaskBoard",
      entityId: id,
      oldData: { title: before.title, isActive: before.isActive },
      newData: { ...v.data },
    },
  });

  return NextResponse.json({ board });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "boards.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Detach tasks before delete
  await prisma.task.updateMany({
    where: { boardId: id },
    data: { boardId: null },
  });

  await prisma.taskBoard.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "BOARD_DELETED",
      entity: "TaskBoard",
      entityId: id,
    },
  });

  return NextResponse.json({ success: true });
}
