import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface ReferralLevelInput {
  id: string;
  level: number;
  commissionRate: number;
  description: string | null;
  isActive: boolean;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "referrals.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const levels = await prisma.referralLevel.findMany({
      orderBy: { level: "asc" },
    });

    return NextResponse.json({ levels });
  } catch (error) {
    console.error("Error fetching referral settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "referrals.configure")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { levels } = body as { levels: ReferralLevelInput[] };

    if (!levels || !Array.isArray(levels)) {
      return NextResponse.json(
        { error: "Invalid levels data" },
        { status: 400 }
      );
    }

    // Validate levels
    for (const level of levels) {
      if (level.level < 1 || level.level > 10) {
        return NextResponse.json(
          { error: "Level must be between 1 and 10" },
          { status: 400 }
        );
      }
      if (level.commissionRate < 0 || level.commissionRate > 100) {
        return NextResponse.json(
          { error: "Commission rate must be between 0 and 100" },
          { status: 400 }
        );
      }
    }

    // Use transaction to update all levels
    await prisma.$transaction(async (tx) => {
      // Delete existing levels and recreate
      await tx.referralLevel.deleteMany({});

      // Create new levels
      await tx.referralLevel.createMany({
        data: levels.map((level) => ({
          level: level.level,
          commissionRate: level.commissionRate,
          description: level.description || null,
          isActive: level.isActive,
        })),
      });
    });

    // Fetch updated levels
    const updatedLevels = await prisma.referralLevel.findMany({
      orderBy: { level: "asc" },
    });

    return NextResponse.json({
      success: true,
      levels: updatedLevels,
      message: "Referral settings saved successfully",
    });
  } catch (error) {
    console.error("Error saving referral settings:", error);
    return NextResponse.json(
      { error: "Failed to save referral settings" },
      { status: 500 }
    );
  }
}
