import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/packages - Get available packages
export async function GET() {
  try {
    const session = await auth();

    // Get all active packages
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    // If user is authenticated, get their current package
    let userPackage = null;
    let userSubscription = null;

    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          packageTier: true,
          packageExpiresAt: true,
        },
      });

      if (user) {
        userPackage = user.packageTier;

        // Get active subscription details
        userSubscription = await prisma.subscription.findFirst({
          where: {
            userId: session.user.id,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    // Format packages for frontend
    const formattedPackages = packages.map((pkg) => ({
      id: pkg.id,
      tier: pkg.tier,
      name: pkg.name,
      description: pkg.description,
      pricing: {
        monthly: pkg.priceMonthly,
        yearly: pkg.priceYearly,
        monthlySavings: pkg.priceYearly
          ? Math.round(((pkg.priceMonthly * 12 - pkg.priceYearly) / (pkg.priceMonthly * 12)) * 100)
          : 0,
      },
      benefits: {
        dailyTaskLimit: pkg.dailyTaskLimit,
        withdrawalFee: pkg.withdrawalFee,
        minWithdrawal: pkg.minWithdrawal,
        referralBonus: pkg.referralBonus,
        xpMultiplier: pkg.xpMultiplier,
        features: pkg.features,
      },
      isCurrentPackage: userPackage === pkg.tier,
      canUpgrade: userPackage
        ? getPackageOrder(pkg.tier) > getPackageOrder(userPackage)
        : pkg.tier !== "FREE",
      canDowngrade: userPackage
        ? getPackageOrder(pkg.tier) < getPackageOrder(userPackage)
        : false,
    }));

    return NextResponse.json({
      packages: formattedPackages,
      currentPackage: userPackage,
      subscription: userSubscription
        ? {
            tier: userSubscription.packageTier,
            startDate: userSubscription.startDate,
            endDate: userSubscription.endDate,
            autoRenew: userSubscription.autoRenew,
            isActive: userSubscription.isActive,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

// POST /api/packages - Subscribe to a package (submit payment request with transaction ID)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { packageTier, billingPeriod, paymentMethod, transactionId, paymentScreenshot } = body;

    // Validate required fields
    if (!packageTier || !paymentMethod || !transactionId) {
      return NextResponse.json(
        { error: "Package tier, payment method, and transaction ID are required" },
        { status: 400 }
      );
    }

    // Validate package tier
    const pkg = await prisma.package.findUnique({
      where: { tier: packageTier },
    });

    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    // Calculate price based on billing period
    const price = billingPeriod === "yearly" && pkg.priceYearly
      ? pkg.priceYearly
      : pkg.priceMonthly;

    // Get current user
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

    // Check if user is trying to downgrade
    if (getPackageOrder(packageTier) <= getPackageOrder(user.packageTier) && user.packageTier !== "FREE") {
      return NextResponse.json(
        { error: "Cannot downgrade or subscribe to same package" },
        { status: 400 }
      );
    }

    // Check if user has a pending subscription request
    const pendingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (pendingSubscription) {
      return NextResponse.json(
        { error: "You already have a pending subscription request. Please wait for admin approval." },
        { status: 400 }
      );
    }

    // Calculate subscription dates (will be updated when approved)
    const startDate = new Date();
    const endDate = new Date();
    if (billingPeriod === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create a pending subscription request with transaction ID
    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        packageTier,
        startDate,
        endDate,
        amount: price,
        paymentMethod: paymentMethod,
        transactionId, // User-provided transaction ID for admin verification
        isActive: false, // Will be activated by admin after payment verification
        autoRenew: false,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: "SYSTEM",
        title: "Package Subscription Submitted",
        message: `Your subscription request for ${pkg.name} ($${price.toFixed(2)}) with transaction ID "${transactionId}" has been submitted and is pending admin verification.`,
        data: {
          subscriptionId: subscription.id,
          packageTier,
          price,
          billingPeriod,
          transactionId,
        },
      },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        packageTier,
        price,
        billingPeriod,
        status: "PENDING_VERIFICATION",
        transactionId,
        startDate,
        endDate,
      },
      message: "Subscription request submitted successfully. Admin will verify your payment and activate your package.",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// Helper function to get package order for comparison
function getPackageOrder(tier: string): number {
  const order: Record<string, number> = {
    FREE: 0,
    BASIC: 1,
    STANDARD: 2,
    PREMIUM: 3,
  };
  return order[tier] ?? 0;
}
