import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { NotificationType, PackageTier } from "@/generated/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/subscriptions/[id] - Get subscription details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "packages.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: subscription.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        packageTier: true,
        packageExpiresAt: true,
      },
    });

    // Get package info
    const pkg = await prisma.package.findUnique({
      where: { tier: subscription.packageTier },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        user: {
          id: subscription.userId,
          name: user?.name || "Unknown",
          email: user?.email || "",
          avatar: user?.avatar,
          currentPackage: user?.packageTier,
          packageExpiresAt: user?.packageExpiresAt,
        },
        package: {
          tier: subscription.packageTier,
          name: pkg?.name || subscription.packageTier,
          price: subscription.amount,
        },
        amount: subscription.amount,
        paymentMethod: subscription.paymentMethod,
        transactionId: subscription.transactionId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isActive: subscription.isActive,
        autoRenew: subscription.autoRenew,
        createdAt: subscription.createdAt,
        status: subscription.isActive ? "ACTIVE" : "PENDING_VERIFICATION",
      },
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

// POST /api/admin/subscriptions/[id] - Approve or reject subscription
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "packages.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (subscription.isActive) {
      return NextResponse.json(
        { error: "Subscription is already active" },
        { status: 400 }
      );
    }

    // Get package info
    const pkg = await prisma.package.findUnique({
      where: { tier: subscription.packageTier },
    });

    if (action === "approve") {
      // Approve subscription - activate it and update user's package
      const startDate = new Date();
      const endDate = new Date();

      // Calculate end date based on the period
      const monthsDiff = Math.round(
        (subscription.endDate.getTime() - subscription.startDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      );

      if (monthsDiff >= 12) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // Update in transaction
      await prisma.$transaction([
        // Activate subscription
        prisma.subscription.update({
          where: { id },
          data: {
            isActive: true,
            startDate,
            endDate,
          },
        }),
        // Update user's package
        prisma.user.update({
          where: { id: subscription.userId },
          data: {
            packageTier: subscription.packageTier as PackageTier,
            packageExpiresAt: endDate,
          },
        }),
        // Create notification for user
        prisma.notification.create({
          data: {
            userId: subscription.userId,
            type: NotificationType.SYSTEM,
            title: "Package Activated!",
            message: `Your ${pkg?.name || subscription.packageTier} package has been activated. Enjoy your premium benefits until ${endDate.toLocaleDateString()}.`,
            data: {
              subscriptionId: subscription.id,
              packageTier: subscription.packageTier,
              expiresAt: endDate.toISOString(),
            },
          },
        }),
        // Create audit log
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "SUBSCRIPTION_APPROVED",
            entity: "Subscription",
            entityId: subscription.id,
            newData: {
              userId: subscription.userId,
              packageTier: subscription.packageTier,
              amount: subscription.amount,
              transactionId: subscription.transactionId,
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Subscription approved successfully",
        subscription: {
          id: subscription.id,
          packageTier: subscription.packageTier,
          startDate,
          endDate,
          status: "ACTIVE",
        },
      });
    } else {
      // Reject subscription
      if (!rejectionReason) {
        return NextResponse.json(
          { error: "Rejection reason is required" },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        // Delete the subscription
        prisma.subscription.delete({
          where: { id },
        }),
        // Create notification for user
        prisma.notification.create({
          data: {
            userId: subscription.userId,
            type: NotificationType.SYSTEM,
            title: "Subscription Request Rejected",
            message: `Your subscription request for ${pkg?.name || subscription.packageTier} package has been rejected. Reason: ${rejectionReason}`,
            data: {
              subscriptionId: subscription.id,
              packageTier: subscription.packageTier,
              rejectionReason,
            },
          },
        }),
        // Create audit log
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "SUBSCRIPTION_REJECTED",
            entity: "Subscription",
            entityId: subscription.id,
            newData: {
              userId: subscription.userId,
              packageTier: subscription.packageTier,
              amount: subscription.amount,
              transactionId: subscription.transactionId,
              rejectionReason,
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Subscription rejected successfully",
      });
    }
  } catch (error) {
    console.error("Error processing subscription:", error);
    return NextResponse.json(
      { error: "Failed to process subscription" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/subscriptions/[id] - Cancel active subscription
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "packages.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Get package info
    const pkg = await prisma.package.findUnique({
      where: { tier: subscription.packageTier },
    });

    await prisma.$transaction([
      // Deactivate subscription
      prisma.subscription.update({
        where: { id },
        data: { isActive: false },
      }),
      // Revert user to FREE package
      prisma.user.update({
        where: { id: subscription.userId },
        data: {
          packageTier: PackageTier.FREE,
          packageExpiresAt: null,
        },
      }),
      // Create notification for user
      prisma.notification.create({
        data: {
          userId: subscription.userId,
          type: NotificationType.SYSTEM,
          title: "Subscription Cancelled",
          message: `Your ${pkg?.name || subscription.packageTier} subscription has been cancelled by admin.${reason ? ` Reason: ${reason}` : ""}`,
          data: {
            subscriptionId: subscription.id,
            packageTier: subscription.packageTier,
            reason,
          },
        },
      }),
      // Create audit log
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SUBSCRIPTION_CANCELLED",
          entity: "Subscription",
          entityId: subscription.id,
          newData: {
            userId: subscription.userId,
            packageTier: subscription.packageTier,
            reason,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
