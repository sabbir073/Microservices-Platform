import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Prisma } from "@/generated/prisma";

// GET /api/admin/users/export - Export users as CSV
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "users.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const role = searchParams.get("role");
    const kyc = searchParams.get("kyc");
    const packageTier = searchParams.get("package");

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (status && status !== "all") {
      where.status = status as Prisma.EnumUserStatusFilter["equals"];
    }
    if (role && role !== "all") {
      where.role = role as Prisma.EnumUserRoleFilter["equals"];
    }
    if (kyc && kyc !== "all") {
      where.kycStatus = kyc as Prisma.EnumKYCStatusFilter["equals"];
    }
    if (packageTier && packageTier !== "all") {
      where.packageTier = packageTier as Prisma.EnumPackageTierFilter["equals"];
    }

    // Fetch all matching users
    const usersRaw = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        country: true,
        role: true,
        status: true,
        kycStatus: true,
        packageTier: true,
        pointsBalance: true,
        cashBalance: true,
        totalEarnings: true,
        totalWithdrawals: true,
        level: true,
        xp: true,
        referralCode: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            referrals: true,
            taskSubmissions: true,
          },
        },
      },
    });

    // Type assertion for Prisma Accelerate
    type UserWithCount = typeof usersRaw[0] & {
      _count: { referrals: number; taskSubmissions: number };
    };
    const users = usersRaw as UserWithCount[];

    // Generate CSV
    const headers = [
      "ID",
      "Name",
      "Email",
      "Username",
      "Phone",
      "Country",
      "Role",
      "Status",
      "KYC Status",
      "Package",
      "Points Balance",
      "Cash Balance",
      "Total Earnings",
      "Total Withdrawals",
      "Level",
      "XP",
      "Referral Code",
      "Email Verified",
      "Phone Verified",
      "Referrals Count",
      "Tasks Completed",
      "Created At",
      "Last Login",
    ];

    const csvRows = [headers.join(",")];

    for (const user of users) {
      const row = [
        user.id,
        `"${(user.name || "").replace(/"/g, '""')}"`,
        user.email,
        user.username || "",
        user.phone || "",
        user.country || "",
        user.role,
        user.status,
        user.kycStatus,
        user.packageTier,
        user.pointsBalance,
        user.cashBalance.toFixed(2),
        user.totalEarnings.toFixed(2),
        user.totalWithdrawals.toFixed(2),
        user.level,
        user.xp,
        user.referralCode,
        user.emailVerified ? "Yes" : "No",
        user.phoneVerified ? "Yes" : "No",
        user._count.referrals,
        user._count.taskSubmissions,
        user.createdAt.toISOString(),
        user.lastLoginAt?.toISOString() || "",
      ];
      csvRows.push(row.join(","));
    }

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting users:", error);
    return NextResponse.json(
      { error: "Failed to export users" },
      { status: 500 }
    );
  }
}
