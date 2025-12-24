import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KYCStatus } from "@/generated/prisma";

// GET /api/profile - Get user's full profile
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        country: true,
        language: true,
        timezone: true,
        level: true,
        xp: true,
        pointsBalance: true,
        totalEarnings: true,
        packageTier: true,
        packageExpiresAt: true,
        referralCode: true,
        kycStatus: true,
        emailVerified: true,
        phoneVerified: true,
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        createdAt: true,
        _count: {
          select: {
            referrals: true,
            taskSubmissions: true,
            transactions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's package info
    const pkg = await prisma.package.findUnique({
      where: { tier: user.packageTier },
    });

    // Calculate XP needed for next level
    const xpForNextLevel = calculateXpForLevel(user.level + 1);
    const xpProgress = user.xp - calculateXpForLevel(user.level);
    const xpNeeded = xpForNextLevel - calculateXpForLevel(user.level);

    // Get achievements count
    const achievementsCount = await prisma.userAchievement.count({
      where: { userId: session.user.id },
    });

    // Get recent activity summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySubmissions = await prisma.taskSubmission.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
      },
      select: { pointsEarned: true, xpEarned: true },
    });

    const todayStats = {
      count: todaySubmissions.length,
      pointsEarned: todaySubmissions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0),
      xpEarned: todaySubmissions.reduce((sum, s) => sum + (s.xpEarned || 0), 0),
    };

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        country: user.country,
        language: user.language || "en",
        timezone: user.timezone || "UTC",
        createdAt: user.createdAt,
      },
      stats: {
        level: user.level,
        xp: user.xp,
        xpProgress,
        xpNeeded,
        xpPercentage: Math.round((xpProgress / xpNeeded) * 100),
        pointsBalance: user.pointsBalance,
        cashBalance: user.pointsBalance / 1000,
        totalEarnings: user.totalEarnings,
        tasksCompleted: user._count.taskSubmissions,
        referralsCount: user._count.referrals,
        achievementsCount,
      },
      package: {
        tier: user.packageTier,
        name: pkg?.name || user.packageTier,
        expiresAt: user.packageExpiresAt,
        features: pkg?.features || [],
        dailyTaskLimit: pkg?.dailyTaskLimit || 10,
      },
      referral: {
        code: user.referralCode,
        link: `${process.env.NEXT_PUBLIC_APP_URL || "https://earngpt.com"}/register?ref=${user.referralCode}`,
      },
      verification: {
        kycStatus: user.kycStatus,
        isEmailVerified: !!user.emailVerified,
        isPhoneVerified: !!user.phoneVerified,
        isFullyVerified:
          user.kycStatus === KYCStatus.APPROVED &&
          !!user.emailVerified &&
          !!user.phoneVerified,
      },
      preferences: {
        notifications: {
          enabled: user.notificationsEnabled,
          email: user.emailNotifications,
          push: user.pushNotifications,
        },
      },
      todayActivity: {
        tasksCompleted: todayStats.count,
        pointsEarned: todayStats.pointsEarned,
        xpEarned: todayStats.xpEarned,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/profile - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      avatar,
      phone,
      country,
      language,
      timezone,
    } = body;

    // Build update data with only allowed fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name || name.length < 2 || name.length > 50) {
        return NextResponse.json(
          { error: "Name must be 2-50 characters" },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    if (phone !== undefined) {
      // Phone validation - basic format check
      if (phone && !/^\+?[\d\s-]{10,15}$/.test(phone)) {
        return NextResponse.json(
          { error: "Invalid phone number format" },
          { status: 400 }
        );
      }
      updateData.phone = phone;
      updateData.phoneVerified = null; // Reset verification when phone changes
    }

    if (country !== undefined) {
      updateData.country = country;
    }

    if (language !== undefined) {
      const validLanguages = ["en", "bn", "hi", "ar", "es", "fr", "de", "zh"];
      if (!validLanguages.includes(language)) {
        return NextResponse.json(
          { error: "Invalid language code" },
          { status: 400 }
        );
      }
      updateData.language = language;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Handle notification preferences update
    if (body.notificationsEnabled !== undefined) {
      updateData.notificationsEnabled = body.notificationsEnabled;
    }
    if (body.emailNotifications !== undefined) {
      updateData.emailNotifications = body.emailNotifications;
    }
    if (body.pushNotifications !== undefined) {
      updateData.pushNotifications = body.pushNotifications;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        country: true,
        language: true,
        timezone: true,
        phoneVerified: true,
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      profile: {
        ...updatedUser,
        isPhoneVerified: !!updatedUser.phoneVerified,
        notifications: {
          enabled: updatedUser.notificationsEnabled,
          email: updatedUser.emailNotifications,
          push: updatedUser.pushNotifications,
        },
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

// Helper function to calculate XP needed for a level
function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  if (level === 5) return 1000;
  if (level === 6) return 2000;
  if (level === 7) return 4000;
  if (level === 8) return 7000;
  if (level === 9) return 11000;
  if (level === 10) return 16000;
  if (level === 11) return 22000;

  // After level 11, each level requires 10000 more XP
  return 22000 + (level - 11) * 10000;
}
