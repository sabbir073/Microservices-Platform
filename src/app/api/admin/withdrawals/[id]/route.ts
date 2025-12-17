import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

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
    if (!hasPermission(adminRole, "withdrawals.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            level: true,
            kycStatus: true,
            packageTier: true,
            cashBalance: true,
            totalWithdrawals: true,
          },
        },
      },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    return NextResponse.json({ withdrawal });
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    return NextResponse.json(
      { error: "Failed to fetch withdrawal" },
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
    if (!hasPermission(adminRole, "withdrawals.process")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, transactionId, rejectionReason } = body;

    // Check if withdrawal exists
    const existingWithdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingWithdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (existingWithdrawal.status !== "PENDING") {
      return NextResponse.json(
        { error: "Withdrawal has already been processed" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Approve the withdrawal
      const [withdrawal] = await prisma.$transaction([
        // Update withdrawal status
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: "COMPLETED",
            processedBy: session.user.id,
            processedAt: new Date(),
            transactionId: transactionId || null,
          },
        }),
        // Update user's total withdrawals
        prisma.user.update({
          where: { id: existingWithdrawal.userId },
          data: {
            totalWithdrawals: { increment: existingWithdrawal.amount },
          },
        }),
        // Create transaction record
        prisma.transaction.create({
          data: {
            userId: existingWithdrawal.userId,
            type: "WITHDRAWAL",
            status: "COMPLETED",
            points: 0,
            amount: -existingWithdrawal.amount,
            description: `Withdrawal via ${existingWithdrawal.method}`,
            reference: id,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        withdrawal,
        message: "Withdrawal approved successfully",
      });
    } else if (action === "reject") {
      // Reject and refund
      const [withdrawal] = await prisma.$transaction([
        // Update withdrawal status
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: "REJECTED",
            processedBy: session.user.id,
            processedAt: new Date(),
            rejectionReason: rejectionReason || "Rejected by admin",
          },
        }),
        // Refund the user's cash balance
        prisma.user.update({
          where: { id: existingWithdrawal.userId },
          data: {
            cashBalance: { increment: existingWithdrawal.amount },
          },
        }),
        // Create refund transaction record
        prisma.transaction.create({
          data: {
            userId: existingWithdrawal.userId,
            type: "REFUND",
            status: "COMPLETED",
            points: 0,
            amount: existingWithdrawal.amount,
            description: `Withdrawal rejected: ${rejectionReason || "Rejected by admin"}`,
            reference: id,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        withdrawal,
        message: "Withdrawal rejected and refunded",
      });
    } else if (action === "process") {
      // Mark as processing
      const withdrawal = await prisma.withdrawal.update({
        where: { id },
        data: {
          status: "PROCESSING",
          processedBy: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        withdrawal,
        message: "Withdrawal marked as processing",
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json(
      { error: "Failed to process withdrawal" },
      { status: 500 }
    );
  }
}
