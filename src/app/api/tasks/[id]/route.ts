import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, PackageTier } from "@/generated/prisma";

// Package tier order for comparison
const PACKAGE_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
};

// GET /api/tasks/:id - Get single task details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        categories: {
          select: { id: true, name: true, icon: true, color: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if user has active submission
    const activeSubmission = await prisma.taskSubmission.findFirst({
      where: {
        taskId: id,
        userId: session.user.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    // Check if user has completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedToday = await prisma.taskSubmission.findFirst({
      where: {
        taskId: id,
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
    });

    return NextResponse.json({
      task: {
        ...task,
        completedCount: task._count.submissions,
        remainingSlots: task.totalLimit
          ? task.totalLimit - task.completedCount
          : null,
      },
      userStatus: {
        hasActiveSubmission: !!activeSubmission,
        activeSubmissionId: activeSubmission?.id,
        completedToday: !!completedToday,
      },
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}
