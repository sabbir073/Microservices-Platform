import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SubmissionStatus,
  TransactionType,
  TransactionStatus,
  NotificationType,
} from "@/generated/prisma";

// POST /api/tasks/:id/submit - Submit task proof
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
    const body = await request.json();
    const { submissionId, proof, proofImages, answers } = body;

    // Get the task
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Find the pending submission
    const submission = await prisma.taskSubmission.findFirst({
      where: {
        id: submissionId,
        taskId: id,
        userId: session.user.id,
        status: SubmissionStatus.PENDING,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "No pending submission found. Please start the task first." },
        { status: 400 }
      );
    }

    // Check if task duration was met (for video/article tasks)
    if (task.duration) {
      const elapsedSeconds = Math.floor(
        (Date.now() - submission.createdAt.getTime()) / 1000
      );
      const requiredDuration = Math.floor(task.duration * 0.8); // 80% of duration required

      if (elapsedSeconds < requiredDuration) {
        return NextResponse.json(
          {
            error: `Please complete the task. ${requiredDuration - elapsedSeconds} seconds remaining.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate quiz answers if it's a quiz task
    let score: number | null = null;
    if (task.type === "QUIZ" && answers && task.questions) {
      const questions = task.questions as Array<{
        question: string;
        options: string[];
        correctAnswer: number;
      }>;

      let correctCount = 0;
      questions.forEach((q, index) => {
        if (answers[index] === q.correctAnswer) {
          correctCount++;
        }
      });

      score = Math.round((correctCount / questions.length) * 100);
    }

    // Determine if task should be auto-approved
    const shouldAutoApprove =
      task.autoApprove ||
      task.type === "VIDEO" ||
      task.type === "ARTICLE" ||
      task.type === "QUIZ";

    const newStatus = shouldAutoApprove
      ? SubmissionStatus.AUTO_APPROVED
      : SubmissionStatus.PENDING;

    // Update submission with proof
    const updatedSubmission = await prisma.taskSubmission.update({
      where: { id: submission.id },
      data: {
        proof: proof || null,
        proofImages: proofImages || [],
        answers: answers || null,
        score,
        status: newStatus,
        ...(shouldAutoApprove && {
          reviewedAt: new Date(),
          pointsEarned: task.pointsReward,
          xpEarned: task.xpReward,
        }),
      },
    });

    // If auto-approved, award points and update user
    if (shouldAutoApprove) {
      // Update user points and XP
      const user = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          pointsBalance: { increment: task.pointsReward },
          xp: { increment: task.xpReward },
          totalEarnings: { increment: task.pointsReward / 1000 }, // Convert to cash equivalent
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: TransactionType.EARNING,
          status: TransactionStatus.COMPLETED,
          points: task.pointsReward,
          amount: task.pointsReward / 1000,
          description: `Completed task: ${task.title}`,
          reference: `task_${task.id}_${submission.id}`,
          metadata: {
            taskId: task.id,
            taskType: task.type,
            submissionId: submission.id,
          },
        },
      });

      // Update task completed count
      await prisma.task.update({
        where: { id: task.id },
        data: {
          completedCount: { increment: 1 },
        },
      });

      // Check for level up
      const newLevel = calculateLevel(user.xp + task.xpReward);
      if (newLevel > user.level) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { level: newLevel },
        });

        // Create level up notification
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            type: NotificationType.ACHIEVEMENT,
            title: "Level Up!",
            message: `Congratulations! You've reached level ${newLevel}!`,
            data: { newLevel, previousLevel: user.level },
          },
        });
      }

      // Create success notification
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: NotificationType.TASK,
          title: "Task Completed!",
          message: `You earned ${task.pointsReward} points from "${task.title}"`,
          data: {
            taskId: task.id,
            points: task.pointsReward,
            xp: task.xpReward,
          },
        },
      });

      // Process referral commissions
      await processReferralCommissions(session.user.id, task.pointsReward, task.id);

      return NextResponse.json({
        submission: updatedSubmission,
        status: "approved",
        message: "Task completed successfully!",
        rewards: {
          points: task.pointsReward,
          xp: task.xpReward,
        },
        newBalance: user.pointsBalance + task.pointsReward,
        score,
      });
    }

    // For manual review tasks
    return NextResponse.json({
      submission: updatedSubmission,
      status: "pending_review",
      message:
        "Your submission has been received and is pending review. You will be notified once it's approved.",
    });
  } catch (error) {
    console.error("Error submitting task:", error);
    return NextResponse.json(
      { error: "Failed to submit task" },
      { status: 500 }
    );
  }
}

// Calculate user level based on XP
function calculateLevel(xp: number): number {
  // Level formula: Each level requires more XP than the previous
  // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, etc.
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  if (xp < 2000) return 5;
  if (xp < 4000) return 6;
  if (xp < 7000) return 7;
  if (xp < 11000) return 8;
  if (xp < 16000) return 9;
  if (xp < 22000) return 10;

  // After level 10, each level requires 10000 more XP
  return Math.floor(10 + (xp - 22000) / 10000);
}

// Process referral commissions (3-level MLM)
async function processReferralCommissions(
  userId: string,
  pointsEarned: number,
  taskId: string
) {
  try {
    // Get referral settings
    const referralLevels = await prisma.referralLevel.findMany({
      where: { isActive: true },
      orderBy: { level: "asc" },
    });

    if (referralLevels.length === 0) {
      // Use default rates if no settings
      referralLevels.push(
        { id: "1", level: 1, commissionRate: 0.1, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: "2", level: 2, commissionRate: 0.05, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: "3", level: 3, commissionRate: 0.02, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }
      );
    }

    // Get user's referral chain (up to 3 levels)
    let currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    for (let level = 1; level <= Math.min(3, referralLevels.length); level++) {
      if (!currentUser?.referredById) break;

      const referrerConfig = referralLevels.find((r) => r.level === level);
      if (!referrerConfig) break;

      const commission = Math.floor(pointsEarned * referrerConfig.commissionRate);

      if (commission > 0) {
        // Credit the referrer
        await prisma.user.update({
          where: { id: currentUser.referredById },
          data: {
            pointsBalance: { increment: commission },
            totalEarnings: { increment: commission / 1000 },
          },
        });

        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: currentUser.referredById,
            type: TransactionType.REFERRAL,
            status: TransactionStatus.COMPLETED,
            points: commission,
            amount: commission / 1000,
            description: `Level ${level} referral commission`,
            reference: `referral_${userId}_${taskId}`,
            metadata: {
              referredUserId: userId,
              sourceTaskId: taskId,
              level,
              commissionRate: referrerConfig.commissionRate,
            },
          },
        });

        // Record referral earning
        await prisma.referralEarning.create({
          data: {
            userId: currentUser.referredById,
            referredUserId: userId,
            level,
            amount: commission / 1000,
            sourceType: "TASK",
            sourceId: taskId,
          },
        });

        // Create notification for referrer
        await prisma.notification.create({
          data: {
            userId: currentUser.referredById,
            type: NotificationType.REFERRAL,
            title: "Referral Commission!",
            message: `You earned ${commission} points from your level ${level} referral's activity!`,
            data: { commission, level, referredUserId: userId },
          },
        });
      }

      // Move up the chain
      currentUser = await prisma.user.findUnique({
        where: { id: currentUser.referredById },
        select: { referredById: true },
      });
    }
  } catch (error) {
    console.error("Error processing referral commissions:", error);
    // Don't throw - referral errors shouldn't block the main task
  }
}
