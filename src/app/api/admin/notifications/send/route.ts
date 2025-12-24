import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import {
  sendPushToUsers,
  sendPushToAll,
  isOneSignalConfigured,
} from "@/lib/onesignal";

interface SendNotificationBody {
  type: string;
  title: string;
  message: string;
  target: "all" | "package" | "specific";
  packageFilter?: string[];
  userIds?: string[];
  sendPush?: boolean;
  url?: string;
  data?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "notifications.send")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: SendNotificationBody = await request.json();
    const { type, title, message, target, packageFilter, userIds, sendPush, url, data } = body;

    // Validate required fields
    if (!type || !title || !message || !target) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate notification type
    const validTypes = [
      "SYSTEM",
      "TASK",
      "WALLET",
      "REFERRAL",
      "PROMOTION",
      "ACHIEVEMENT",
      "LOTTERY",
      "SOCIAL",
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid notification type" },
        { status: 400 }
      );
    }

    // Get target user IDs based on selection
    let targetUserIds: string[] = [];

    if (target === "all") {
      // Get all user IDs
      const users = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (target === "package" && packageFilter?.length) {
      // Get users by package tier
      const users = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          packageTier: { in: packageFilter as ("FREE" | "BASIC" | "STANDARD" | "PREMIUM")[] },
        },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (target === "specific" && userIds?.length) {
      // Use provided user IDs
      targetUserIds = userIds;
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: "No recipients found for the selected criteria" },
        { status: 400 }
      );
    }

    // Create in-app notifications for all target users
    await prisma.notification.createMany({
      data: targetUserIds.map((userId) => ({
        userId,
        type: type as "SYSTEM" | "TASK" | "WALLET" | "REFERRAL" | "PROMOTION" | "ACHIEVEMENT" | "LOTTERY" | "SOCIAL",
        title,
        message,
        data: {
          sentBy: session.user.id,
          sentAt: new Date().toISOString(),
          targetType: target,
          ...data,
        },
      })),
    });

    // Send push notifications via OneSignal if requested
    let pushResult = null;
    if (sendPush) {
      if (!isOneSignalConfigured()) {
        pushResult = { success: false, error: "OneSignal not configured" };
      } else if (target === "all") {
        pushResult = await sendPushToAll(
          title,
          message,
          { type, ...data },
          url
        );
      } else {
        pushResult = await sendPushToUsers(
          targetUserIds,
          title,
          message,
          { type, ...data },
          url
        );
      }
    }

    return NextResponse.json({
      success: true,
      recipientCount: targetUserIds.length,
      message: `Notification sent to ${targetUserIds.length} user(s)`,
      push: sendPush
        ? {
            sent: pushResult?.success || false,
            recipients: pushResult?.recipients,
            error: pushResult?.error,
          }
        : null,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
