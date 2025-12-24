import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TaskStatus, PackageTier, SubmissionStatus } from "@/generated/prisma";

// Package tier order for comparison
const PACKAGE_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
};

// POST /api/tasks/:id/start - Start a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get task with full details
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if task is active
    if (task.status !== TaskStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Task is not available" },
        { status: 400 }
      );
    }

    // Check if task has expired
    if (task.expiresAt && new Date() > task.expiresAt) {
      return NextResponse.json({ error: "Task has expired" }, { status: 400 });
    }

    // Check if task has started
    if (task.startsAt && new Date() < task.startsAt) {
      return NextResponse.json(
        { error: "Task has not started yet" },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        level: true,
        packageTier: true,
        country: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check user level requirement
    if (user.level < task.minLevel) {
      return NextResponse.json(
        { error: `Minimum level ${task.minLevel} required` },
        { status: 403 }
      );
    }

    // Check package tier requirement
    if (PACKAGE_ORDER[user.packageTier] < PACKAGE_ORDER[task.requiredPackage]) {
      return NextResponse.json(
        { error: `${task.requiredPackage} package or higher required` },
        { status: 403 }
      );
    }

    // Check country restriction
    if (task.countries.length > 0 && user.country) {
      if (!task.countries.includes(user.country)) {
        return NextResponse.json(
          { error: "Task not available in your country" },
          { status: 403 }
        );
      }
    }

    // Check if task has reached total limit
    if (task.totalLimit && task.completedCount >= task.totalLimit) {
      return NextResponse.json(
        { error: "Task limit has been reached" },
        { status: 400 }
      );
    }

    // Check if user has already completed this task today (daily limit)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySubmissions = await prisma.taskSubmission.count({
      where: {
        taskId: id,
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED", "PENDING"] },
      },
    });

    const dailyLimit = task.dailyLimit || 1;
    if (todaySubmissions >= dailyLimit) {
      return NextResponse.json(
        { error: "Daily limit reached for this task" },
        { status: 400 }
      );
    }

    // Check cooldown period
    if (task.cooldownMinutes > 0) {
      const cooldownTime = new Date(
        Date.now() - task.cooldownMinutes * 60 * 1000
      );
      const recentSubmission = await prisma.taskSubmission.findFirst({
        where: {
          taskId: id,
          userId: session.user.id,
          createdAt: { gte: cooldownTime },
        },
      });

      if (recentSubmission) {
        const waitTime = Math.ceil(
          (recentSubmission.createdAt.getTime() +
            task.cooldownMinutes * 60 * 1000 -
            Date.now()) /
            1000 /
            60
        );
        return NextResponse.json(
          { error: `Please wait ${waitTime} more minutes before starting again` },
          { status: 400 }
        );
      }
    }

    // Check if user already has a pending submission for this task
    const existingPending = await prisma.taskSubmission.findFirst({
      where: {
        taskId: id,
        userId: session.user.id,
        status: SubmissionStatus.PENDING,
      },
    });

    if (existingPending) {
      // Return the existing submission instead of creating a new one
      return NextResponse.json({
        submission: existingPending,
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          instructions: task.instructions,
          type: task.type,
          pointsReward: task.pointsReward,
          xpReward: task.xpReward,
          duration: task.duration,
          contentUrl: task.contentUrl,
          socialPlatform: task.socialPlatform,
          socialAction: task.socialAction,
          socialUrl: task.socialUrl,
          questions: task.questions,
          autoApprove: task.autoApprove,
        },
        message: "You already have an active submission for this task",
      });
    }

    // Create new submission
    const submission = await prisma.taskSubmission.create({
      data: {
        taskId: id,
        userId: session.user.id,
        status: SubmissionStatus.PENDING,
      },
    });

    return NextResponse.json({
      submission: {
        id: submission.id,
        taskId: submission.taskId,
        status: submission.status,
        createdAt: submission.createdAt,
      },
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        type: task.type,
        pointsReward: task.pointsReward,
        xpReward: task.xpReward,
        duration: task.duration,
        contentUrl: task.contentUrl,
        socialPlatform: task.socialPlatform,
        socialAction: task.socialAction,
        socialUrl: task.socialUrl,
        questions: task.questions,
        autoApprove: task.autoApprove,
      },
      message: "Task started successfully",
    });
  } catch (error) {
    console.error("Error starting task:", error);
    return NextResponse.json(
      { error: "Failed to start task" },
      { status: 500 }
    );
  }
}
