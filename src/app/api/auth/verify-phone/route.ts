import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPhoneToken, isFirebaseConfigured } from "@/lib/firebase-admin";
import { NotificationType } from "@/generated/prisma";

// POST /api/auth/verify-phone - Verify phone number using Firebase token
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Phone verification is not available" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: "Firebase ID token is required" },
        { status: 400 }
      );
    }

    // Verify the Firebase ID token
    const result = await verifyPhoneToken(idToken);

    if (!result.success || !result.phoneNumber) {
      return NextResponse.json(
        { error: result.error || "Failed to verify phone number" },
        { status: 400 }
      );
    }

    // Check if phone number is already verified by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: result.phoneNumber,
        phoneVerified: { not: null },
        id: { not: session.user.id },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This phone number is already verified by another user" },
        { status: 400 }
      );
    }

    // Update user's phone and verification status
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phone: result.phoneNumber,
        phoneVerified: new Date(),
      },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: NotificationType.SYSTEM,
        title: "Phone Verified",
        message: `Your phone number ${result.phoneNumber} has been verified successfully.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
      phone: user.phone,
      verifiedAt: user.phoneVerified,
    });
  } catch (error) {
    console.error("Error verifying phone:", error);
    return NextResponse.json(
      { error: "Failed to verify phone number" },
      { status: 500 }
    );
  }
}

// GET /api/auth/verify-phone - Get phone verification status
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        phone: true,
        phoneVerified: true,
      },
    });

    return NextResponse.json({
      phone: user?.phone || null,
      isVerified: !!user?.phoneVerified,
      verifiedAt: user?.phoneVerified,
      firebaseConfigured: isFirebaseConfigured(),
    });
  } catch (error) {
    console.error("Error getting phone status:", error);
    return NextResponse.json(
      { error: "Failed to get phone status" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/verify-phone - Remove phone verification
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove phone and verification
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        phone: null,
        phoneVerified: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number removed",
    });
  } catch (error) {
    console.error("Error removing phone:", error);
    return NextResponse.json(
      { error: "Failed to remove phone number" },
      { status: 500 }
    );
  }
}
