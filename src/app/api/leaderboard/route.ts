import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackageTier } from "@/generated/prisma";

// GET /api/leaderboard - Get leaderboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "points"; // points, xp, referrals
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let leaderboard: Array<{
      rank: number;
      userId: string;
      name: string | null;
      avatar: string | null;
      level: number;
      packageTier: PackageTier;
      value: number;
    }> = [];

    if (type === "points") {
      // Get from user totals sorted by earnings
      const users = await prisma.user.findMany({
        orderBy: { totalEarnings: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          avatar: true,
          level: true,
          packageTier: true,
          totalEarnings: true,
        },
      });

      leaderboard = users.map((u, idx) => ({
        rank: idx + 1,
        userId: u.id,
        name: u.name || "Anonymous",
        avatar: u.avatar,
        level: u.level,
        packageTier: u.packageTier,
        value: Math.round(u.totalEarnings * 1000),
      }));
    } else if (type === "xp") {
      // Get from user totals sorted by XP
      const users = await prisma.user.findMany({
        orderBy: { xp: "desc" },
        take: limit,
        select: {
          id: true,
          name: true,
          avatar: true,
          level: true,
          packageTier: true,
          xp: true,
        },
      });

      leaderboard = users.map((u, idx) => ({
        rank: idx + 1,
        userId: u.id,
        name: u.name || "Anonymous",
        avatar: u.avatar,
        level: u.level,
        packageTier: u.packageTier,
        value: u.xp,
      }));
    } else if (type === "referrals") {
      // Get users with most referrals by counting referredById
      const users = await prisma.user.findMany({
        orderBy: {
          referrals: { _count: "desc" },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          avatar: true,
          level: true,
          packageTier: true,
        },
      });

      // Get referral counts separately
      const referralCounts = await Promise.all(
        users.map((u) =>
          prisma.user.count({ where: { referredById: u.id } })
        )
      );

      leaderboard = users.map((u, idx) => ({
        rank: idx + 1,
        userId: u.id,
        name: u.name || "Anonymous",
        avatar: u.avatar,
        level: u.level,
        packageTier: u.packageTier,
        value: referralCounts[idx],
      }));
    }

    // Get current user's rank if authenticated
    let currentUserRank = null;
    if (session?.user?.id) {
      const userIndex = leaderboard.findIndex(
        (entry) => entry.userId === session.user.id
      );

      if (userIndex !== -1) {
        currentUserRank = {
          rank: userIndex + 1,
          value: leaderboard[userIndex].value,
          isInTop: userIndex < limit,
        };
      } else {
        // User not in top N, get their stats
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            totalEarnings: true,
            xp: true,
          },
        });

        if (user) {
          let userValue = 0;
          if (type === "points") {
            userValue = Math.round(user.totalEarnings * 1000);
          } else if (type === "xp") {
            userValue = user.xp;
          } else if (type === "referrals") {
            userValue = await prisma.user.count({
              where: { referredById: session.user.id },
            });
          }

          currentUserRank = {
            rank: "50+",
            value: userValue,
            isInTop: false,
          };
        }
      }
    }

    // Get leaderboard metadata
    const totalParticipants = await prisma.user.count();

    return NextResponse.json({
      leaderboard,
      metadata: {
        type,
        limit,
        totalParticipants,
        lastUpdated: new Date().toISOString(),
      },
      currentUser: currentUserRank,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
