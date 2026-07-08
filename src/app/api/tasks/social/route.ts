import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType } from "@/generated/prisma/client";
import { mapSocialTaskRow } from "@/lib/social-tasks";
import { getEffectivePackage, packageHasFeature } from "@/lib/packages";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "available";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, level: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userPackage = await getEffectivePackage(session.user.id);

  // For non-"available", look up the user's submissions for SOCIAL tasks
  if (status !== "available") {
    const statusMap: Record<string, "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"> = {
      submitted: "PENDING",
      in_progress: "PENDING",
      approved: "APPROVED",
      rejected: "REJECTED",
      expired: "EXPIRED",
    };
    const subStatus = statusMap[status];
    const submissions = await prisma.taskSubmission.findMany({
      where: {
        userId: user.id,
        ...(subStatus === "EXPIRED"
          ? { task: { type: TaskType.SOCIAL, expiresAt: { lt: new Date() } } }
          : { status: subStatus, task: { type: TaskType.SOCIAL } }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const taskIds = [...new Set(submissions.map((s) => s.taskId))];
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
    });
    return NextResponse.json({
      tasks: tasks.map((t) => mapSocialTaskRow(t)),
    });
  }

  // Plan must allow social tasks at all.
  if (
    !packageHasFeature(userPackage, "tasks") ||
    !packageHasFeature(userPackage, "socialTasks")
  ) {
    return NextResponse.json({ tasks: [] });
  }

  const accessLevel = userPackage?.accessLevel ?? 0;

  const tasks = await prisma.task.findMany({
    where: {
      type: TaskType.SOCIAL,
      status: TaskStatus.ACTIVE,
      minLevel: { lte: user.level },
      requiredAccessLevel: { lte: accessLevel },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    tasks: tasks.map((t) => mapSocialTaskRow(t)),
  });
}
