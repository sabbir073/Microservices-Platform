import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setExternalUserId, isOneSignalConfigured } from "@/lib/onesignal";

// POST /api/notifications/push - Register device for push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { playerId, platform } = body;

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID is required" },
        { status: 400 }
      );
    }

    // Check if OneSignal is configured
    if (!isOneSignalConfigured()) {
      return NextResponse.json(
        { error: "Push notifications are not configured" },
        { status: 503 }
      );
    }

    // Set the external user ID in OneSignal
    const result = await setExternalUserId(playerId, session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to register device" },
        { status: 500 }
      );
    }

    // Ensure push notifications are enabled for the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { pushNotifications: true },
    });

    return NextResponse.json({
      success: true,
      message: "Device registered for push notifications",
    });
  } catch (error) {
    console.error("Error registering device:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    );
  }
}

// GET /api/notifications/push - Get push notification status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        pushNotifications: true,
        notificationsEnabled: true,
        emailNotifications: true,
      },
    });

    return NextResponse.json({
      enabled: isOneSignalConfigured(),
      pushEnabled: user?.pushNotifications ?? false,
      emailEnabled: user?.emailNotifications ?? false,
      notificationsEnabled: user?.notificationsEnabled ?? false,
    });
  } catch (error) {
    console.error("Error getting push status:", error);
    return NextResponse.json(
      { error: "Failed to get push status" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/push - Update push notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pushEnabled, emailEnabled, notificationsEnabled } = body;

    const updateData: Record<string, boolean> = {};

    if (typeof pushEnabled === "boolean") {
      updateData.pushNotifications = pushEnabled;
    }
    if (typeof emailEnabled === "boolean") {
      updateData.emailNotifications = emailEnabled;
    }
    if (typeof notificationsEnabled === "boolean") {
      updateData.notificationsEnabled = notificationsEnabled;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid preferences provided" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        pushNotifications: true,
        emailNotifications: true,
        notificationsEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        pushEnabled: user.pushNotifications,
        emailEnabled: user.emailNotifications,
        notificationsEnabled: user.notificationsEnabled,
      },
    });
  } catch (error) {
    console.error("Error updating push preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
