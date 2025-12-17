import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface SendNotificationBody {
  type: string;
  title: string;
  message: string;
  target: "all" | "package" | "specific";
  packageFilter?: string[];
  userIds?: string[];
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
    const { type, title, message, target, packageFilter, userIds } = body;

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

    // Create notifications for all target users
    // Using createMany for better performance
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
        },
      })),
    });

    return NextResponse.json({
      success: true,
      recipientCount: targetUserIds.length,
      message: `Notification sent to ${targetUserIds.length} user(s)`,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
