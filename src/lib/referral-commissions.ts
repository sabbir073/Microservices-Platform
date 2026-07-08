import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus, NotificationType } from "@/generated/prisma";
import { notifyUser } from "@/lib/notify";

/**
 * Process referral commissions for a user's task completion.
 *
 * Walks up the user's referral chain (up to 10 levels). Each upline user only
 * earns commission for levels their plan unlocks:
 *   - `Package.referralCommissionLevels === 0` → no commission at any level.
 *   - `referralCommissionLevels === N` → earns from L1..L_N only.
 *
 * Higher levels in the chain still earn (or skip) based on their own plan —
 * one ineligible upline does not stop commissions from flowing past them.
 */
export async function processReferralCommissions(
  userId: string,
  pointsEarned: number,
  taskId: string
) {
  try {
    const referralLevels = await prisma.referralLevel.findMany({
      where: { isActive: true },
      orderBy: { level: "asc" },
    });

    if (referralLevels.length === 0) {
      // Default L1 = 10% if admin hasn't seeded any levels.
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

    let currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredById: true },
    });

    for (let level = 1; level <= Math.min(10, referralLevels.length); level++) {
      if (!currentUser?.referredById) break;

      const referrerConfig = referralLevels.find((r) => r.level === level);
      if (!referrerConfig) break;

      // Look up the upline's plan — they only earn this level if their plan
      // unlocks it (referralCommissionLevels >= level) and referrals are enabled.
      const upline = await prisma.user.findUnique({
        where: { id: currentUser.referredById },
        select: {
          id: true,
          referredById: true,
          package: {
            select: {
              referralCommissionLevels: true,
              referralsEnabled: true,
            },
          },
        },
      });

      const allowedLevels = upline?.package?.referralCommissionLevels ?? 0;
      const referralsOn = upline?.package?.referralsEnabled ?? false;
      const eligible = referralsOn && allowedLevels >= level;

      if (!eligible) {
        // Surfaces the exact reason a commission was skipped — invaluable
        // when admin reports "user X is still earning at level N" and we
        // need to verify the gate fired.
        console.log(
          `[referral-commission] skip user=${currentUser.referredById} level=${level} ` +
            `reason=${!referralsOn ? "referrals_disabled" : `plan_only_unlocks_${allowedLevels}`}`
        );
      }

      if (eligible) {
        let commission: number;
        if (referrerConfig.commissionType === "PERCENTAGE") {
          commission = Math.floor(pointsEarned * (referrerConfig.commissionValue / 100));
        } else {
          commission = Math.floor(referrerConfig.commissionValue * 1000);
        }

        if (commission > 0) {
          await prisma.user.update({
            where: { id: currentUser.referredById },
            data: {
              pointsBalance: { increment: commission },
              totalEarnings: { increment: commission / 1000 },
            },
          });

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
              reference: `referral_${userId}_${taskId}_L${level}`,
              metadata: {
                referredUserId: userId,
                sourceTaskId: taskId,
                level,
                commissionType: referrerConfig.commissionType,
                commissionValue: referrerConfig.commissionValue,
              },
            },
          });

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

          await notifyUser({
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
            link: "/referrals",
          });
        }
      }

      // Always continue up the chain — a free-tier upline doesn't block their
      // own upline from earning their (eligible) commission.
      currentUser = upline
        ? { referredById: upline.referredById }
        : null;
    }
  } catch (error) {
    console.error("Error processing referral commissions:", error);
    // Don't throw — referral errors shouldn't block the main task.
  }
}
