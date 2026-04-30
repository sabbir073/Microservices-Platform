import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { processReferralCommissions } from "@/lib/referral-commissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "submissions.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const submission = await prisma.taskSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            level: true,
            packageTier: true,
          },
        },
        task: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, adminNote } = body;
    // Normalize legacy/new action names
    const normalized: "approved" | "rejected" | "revision_requested" | null =
      action === "approve" || action === "approved"
        ? "approved"
        : action === "reject" || action === "rejected"
        ? "rejected"
        : action === "revision_requested" || action === "request_revision"
        ? "revision_requested"
        : null;
    if (!normalized) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if submission exists
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: { id },
      include: {
        task: true,
        user: true,
      },
    });

    if (!existingSubmission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (existingSubmission.status !== "PENDING") {
      return NextResponse.json(
        { error: "Submission has already been reviewed" },
        { status: 400 }
      );
    }

    if (normalized === "approved") {
      if (!hasPermission(adminRole, "submissions.approve")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Approve the submission and award points/XP
      const [submission] = await prisma.$transaction([
        // Update submission
        prisma.taskSubmission.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            pointsEarned: existingSubmission.task.pointsReward,
            xpEarned: existingSubmission.task.xpReward,
          },
        }),
        // Update user balance and XP
        prisma.user.update({
          where: { id: existingSubmission.userId },
          data: {
            pointsBalance: { increment: existingSubmission.task.pointsReward },
            xp: { increment: existingSubmission.task.xpReward },
            totalEarnings: { increment: existingSubmission.task.pointsReward * 0.001 }, // Assuming 1000 pts = $1
          },
        }),
        // Update task completed count
        prisma.task.update({
          where: { id: existingSubmission.taskId },
          data: {
            completedCount: { increment: 1 },
          },
        }),
        // Create transaction record
        prisma.transaction.create({
          data: {
            userId: existingSubmission.userId,
            type: "EARNING",
            status: "COMPLETED",
            points: existingSubmission.task.pointsReward,
            amount: existingSubmission.task.pointsReward * 0.001,
            description: `Earned from task: ${existingSubmission.task.title}`,
            reference: existingSubmission.id,
          },
        }),
      ]);

      // Process referral commissions (after transaction completes)
      await processReferralCommissions(
        existingSubmission.userId,
        existingSubmission.task.pointsReward,
        existingSubmission.taskId
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SUBMISSION_APPROVED",
          entity: "TaskSubmission",
          entityId: id,
          newData: { adminNote: adminNote ?? null },
        },
      });

      return NextResponse.json({
        success: true,
        submission,
        message: "Submission approved successfully",
      });
    } else if (normalized === "rejected") {
      if (!hasPermission(adminRole, "submissions.reject")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const submission = await prisma.taskSubmission.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || "Submission rejected by admin",
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId: existingSubmission.userId,
          type: "TASK",
          title: "Submission rejected",
          message: `Your submission for "${existingSubmission.task.title}" was rejected. Reason: ${
            rejectionReason || "Not specified"
          }${adminNote ? `\n\n${adminNote}` : ""}`,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SUBMISSION_REJECTED",
          entity: "TaskSubmission",
          entityId: id,
          newData: {
            rejectionReason: rejectionReason ?? null,
            adminNote: adminNote ?? null,
          },
        },
      });

      return NextResponse.json({
        success: true,
        submission,
        message: "Submission rejected",
      });
    } else {
      // revision_requested
      if (!hasPermission(adminRole, "submissions.reject")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const submission = await prisma.taskSubmission.update({
        where: { id },
        data: {
          status: "REVISION_REQUESTED",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: adminNote || "Revision requested",
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId: existingSubmission.userId,
          type: "TASK",
          title: "Revision requested",
          message: `Please revise your submission for "${existingSubmission.task.title}". ${
            adminNote ?? ""
          }`,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SUBMISSION_REVISION_REQUESTED",
          entity: "TaskSubmission",
          entityId: id,
          newData: { adminNote: adminNote ?? null },
        },
      });

      return NextResponse.json({
        success: true,
        submission,
        message: "Revision requested",
      });
    }
  } catch (error) {
    console.error("Error updating submission:", error);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}
