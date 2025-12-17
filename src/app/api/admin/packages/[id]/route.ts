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
    if (!hasPermission(adminRole, "packages.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Get subscriber count
    const subscriberCount = await prisma.user.count({
      where: { packageTier: pkg.tier },
    });

    return NextResponse.json({ package: pkg, subscriberCount });
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Check if package exists
    const existingPackage = await prisma.package.findUnique({
      where: { id },
    });

    if (!existingPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      dailyTaskLimit,
      withdrawalFee,
      minWithdrawal,
      features,
      referralBonus,
      xpMultiplier,
      isActive,
      order,
    } = body;

    // Update the package
    const pkg = await prisma.package.update({
      where: { id },
      data: {
        name,
        description: description || null,
        priceMonthly: parseFloat(priceMonthly.toString()),
        priceYearly: priceYearly ? parseFloat(priceYearly.toString()) : null,
        dailyTaskLimit: parseInt(dailyTaskLimit.toString()),
        withdrawalFee: parseFloat(withdrawalFee.toString()),
        minWithdrawal: parseFloat(minWithdrawal.toString()),
        features: features || [],
        referralBonus: parseFloat(referralBonus.toString()),
        xpMultiplier: parseFloat(xpMultiplier.toString()),
        isActive: isActive ?? true,
        order: parseInt(order?.toString() || "0"),
      },
    });

    return NextResponse.json({ success: true, package: pkg });
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}
