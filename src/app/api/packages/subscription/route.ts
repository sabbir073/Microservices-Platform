import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/packages/subscription - Get user's subscription status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user with package info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        packageTier: true,
        packageExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get pending subscription (if any)
    const pendingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: false,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get subscription history
    const subscriptionHistory = await prisma.subscription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get package details
    const pkg = await prisma.package.findUnique({
      where: { tier: user.packageTier },
    });

    return NextResponse.json({
      currentPackage: {
        tier: user.packageTier,
        name: pkg?.name || user.packageTier,
        expiresAt: user.packageExpiresAt,
        features: pkg?.features || [],
        dailyTaskLimit: pkg?.dailyTaskLimit || 10,
        withdrawalFee: pkg?.withdrawalFee || 0,
        minWithdrawal: pkg?.minWithdrawal || 5,
      },
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            tier: activeSubscription.packageTier,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            amount: activeSubscription.amount,
            autoRenew: activeSubscription.autoRenew,
            paymentMethod: activeSubscription.paymentMethod,
          }
        : null,
      pendingSubscription: pendingSubscription
        ? {
            id: pendingSubscription.id,
            tier: pendingSubscription.packageTier,
            amount: pendingSubscription.amount,
            transactionId: pendingSubscription.transactionId,
            paymentMethod: pendingSubscription.paymentMethod,
            submittedAt: pendingSubscription.createdAt,
            status: "PENDING_VERIFICATION",
          }
        : null,
      history: subscriptionHistory.map((sub) => ({
        id: sub.id,
        tier: sub.packageTier,
        amount: sub.amount,
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        paymentMethod: sub.paymentMethod,
        createdAt: sub.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

// DELETE /api/packages/subscription - Cancel pending subscription request
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find pending subscription
    const pendingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingSubscription) {
      return NextResponse.json(
        { error: "No pending subscription to cancel" },
        { status: 400 }
      );
    }

    // Delete the pending subscription
    await prisma.subscription.delete({
      where: { id: pendingSubscription.id },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "SYSTEM",
        title: "Subscription Request Cancelled",
        message: `Your pending subscription request for ${pendingSubscription.packageTier} package has been cancelled.`,
        data: {
          subscriptionId: pendingSubscription.id,
          packageTier: pendingSubscription.packageTier,
        },
      },
    });

    return NextResponse.json({
      message: "Pending subscription request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
