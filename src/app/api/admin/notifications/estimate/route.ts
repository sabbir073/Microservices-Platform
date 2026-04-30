import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Prisma } from "@/generated/prisma/client";

/**
 * POST /api/admin/notifications/estimate
 *
 * Returns the count of users matching a notification segment.
 * Used by the Send Notification form to show "Estimated Reach" live.
 */
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

    const body = await request.json();
    const {
      target,
      packageFilter,
      userIds,
      // Segment criteria
      packages,
      minLevel,
      maxLevel,
      country,
      activeWithinDays,
      minTasksCompleted,
    }: {
      target: "all" | "package" | "specific" | "segment";
      packageFilter?: string[];
      userIds?: string[];
      packages?: string[];
      minLevel?: number;
      maxLevel?: number;
      country?: string;
      activeWithinDays?: number;
      minTasksCompleted?: number;
    } = body;

    if (target === "all") {
      const count = await prisma.user.count({ where: { status: "ACTIVE" } });
      return NextResponse.json({ count });
    }

    if (target === "specific") {
      return NextResponse.json({ count: userIds?.length ?? 0 });
    }

    const where: Prisma.UserWhereInput = { status: "ACTIVE" };

    if (target === "package" && packageFilter?.length) {
      where.packageTier = {
        in: packageFilter as ("FREE" | "STARTER" | "PRO" | "ELITE" | "VIP")[],
      };
    }

    if (target === "segment") {
      if (packages && packages.length > 0) {
        where.packageTier = {
          in: packages as ("FREE" | "STARTER" | "PRO" | "ELITE" | "VIP")[],
        };
      }
      if (typeof minLevel === "number" && minLevel > 0) {
        where.level = { ...(where.level as object), gte: minLevel };
      }
      if (typeof maxLevel === "number" && maxLevel > 0) {
        where.level = { ...(where.level as object), lte: maxLevel };
      }
      if (country && country.trim()) {
        where.country = { contains: country.trim(), mode: "insensitive" };
      }
      if (typeof activeWithinDays === "number" && activeWithinDays > 0) {
        const since = new Date();
        since.setDate(since.getDate() - activeWithinDays);
        where.lastLoginAt = { gte: since };
      }
      if (typeof minTasksCompleted === "number" && minTasksCompleted > 0) {
        where.taskSubmissions = {
          some: { status: "APPROVED" },
        };
        // Note: counting approved submissions ≥ N requires a different approach;
        // we approximate by requiring at least one approval. Sharper filtering
        // happens in send route via groupBy.
      }
    }

    const count = await prisma.user.count({ where });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error estimating reach:", error);
    return NextResponse.json(
      { error: "Failed to estimate reach" },
      { status: 500 }
    );
  }
}
