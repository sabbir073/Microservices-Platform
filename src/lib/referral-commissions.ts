import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus, NotificationType } from "@/generated/prisma";

/**
 * Process referral commissions for a user's task completion
 * Supports both PERCENTAGE and FLAT_RATE commission types
 * Processes up to 10 levels of referrals
 */
export async function processReferralCommissions(
  userId: string,
  pointsEarned: number,
  taskId: string
) {
  try {
    // Get referral settings
    const referralLevels = await prisma.referralLevel.findMany({
      where: { isActive: true },
      orderBy: { level: "asc" },
    });

    if (referralLevels.length === 0) {
      // Use default rates if no settings (10% for level 1)
      referralLevels.push({
        id: "1",
        level: 1,
        commissionType: "PERCENTAGE" as const,
        commissionValue: 10,
        commissionRate: 10,
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get user's referral chain (up to 10 levels)
    let currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    for (let level = 1; level <= Math.min(10, referralLevels.length); level++) {
      if (!currentUser?.referredById) break;

      const referrerConfig = referralLevels.find((r) => r.level === level);
      if (!referrerConfig) break;

      // Calculate commission based on type
      let commission: number;
      if (referrerConfig.commissionType === "PERCENTAGE") {
        // Percentage-based commission (value is percentage 0-100)
        commission = Math.floor(pointsEarned * (referrerConfig.commissionValue / 100));
      } else {
        // Flat rate commission (value is fixed points amount)
        commission = Math.floor(referrerConfig.commissionValue * 1000); // Convert dollars to points
      }

      if (commission > 0) {
        // Credit the referrer
        await prisma.user.update({
          where: { id: currentUser.referredById },
          data: {
            pointsBalance: { increment: commission },
            totalEarnings: { increment: commission / 1000 },
          },
        });

        // Create transaction
        await prisma.transaction.create({
          data: {
            userId: currentUser.referredById,
            type: TransactionType.REFERRAL,
            status: TransactionStatus.COMPLETED,
            points: commission,
            amount: commission / 1000,
            description: `Level ${level} referral commission (${
              referrerConfig.commissionType === "PERCENTAGE"
                ? `${referrerConfig.commissionValue}%`
                : `$${referrerConfig.commissionValue}`
            })`,
            reference: `referral_${userId}_${taskId}`,
            metadata: {
              referredUserId: userId,
              sourceTaskId: taskId,
              level,
              commissionType: referrerConfig.commissionType,
              commissionValue: referrerConfig.commissionValue,
            },
          },
        });

        // Record referral earning
        await prisma.referralEarning.create({
          data: {
            userId: currentUser.referredById,
            referredUserId: userId,
            level,
            amount: commission / 1000,
            sourceType: "TASK",
            sourceId: taskId,
          },
        });

        // Create notification for referrer
        await prisma.notification.create({
          data: {
            userId: currentUser.referredById,
            type: NotificationType.REFERRAL,
            title: "Referral Commission!",
            message: `You earned ${commission} points from your level ${level} referral's activity!`,
            data: {
              commission,
              level,
              referredUserId: userId,
              commissionType: referrerConfig.commissionType,
              commissionValue: referrerConfig.commissionValue,
            },
          },
        });
      }

      // Move up the chain
      currentUser = await prisma.user.findUnique({
        where: { id: currentUser.referredById },
        select: { referredById: true },
      });
    }
  } catch (error) {
    console.error("Error processing referral commissions:", error);
    // Don't throw - referral errors shouldn't block the main task
  }
}
