import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@/generated/prisma/client";
import { isCronAuthorized } from "@/lib/cron";
import { defaultPackage } from "@/lib/packages";
import { deliverToUser } from "@/lib/notify";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// GET|POST /api/cron/subscription-expiry
// For each active subscription whose end date has passed:
//   • autoRenew + enough wallet balance → charge again, extend the period, keep
//     the package (idempotent: once extended the row leaves the due set).
//   • otherwise → deactivate the subscription and revert the user to the default
//     package (getEffectivePackage already treats it as default at read time).
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();
    const due = await prisma.subscription.findMany({
      where: { isActive: true, endDate: { lte: now } },
      take: 100,
    });

    // Subscription has no `user` relation — batch-load balance + current
    // entitlement expiry separately.
    const balanceById = new Map<string, number>();
    const expiresById = new Map<string, Date | null>();
    if (due.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: due.map((s) => s.userId) } },
        select: { id: true, cashBalance: true, packageExpiresAt: true },
      });
      for (const u of users) {
        balanceById.set(u.id, u.cashBalance);
        expiresById.set(u.id, u.packageExpiresAt);
      }
    }

    const fallback = await defaultPackage();

    let renewed = 0;
    let expired = 0;

    for (const sub of due) {
      const periodMs = Math.max(
        sub.endDate.getTime() - sub.startDate.getTime(),
        THIRTY_DAYS
      );
      const newEnd = new Date(now.getTime() + periodMs);

      const canRenew =
        sub.autoRenew &&
        sub.amount > 0 &&
        !!sub.packageId &&
        (balanceById.get(sub.userId) ?? 0) >= sub.amount;

      if (canRenew) {
        try {
          await prisma.$transaction(async (tx) => {
            // Conditional debit — never lets the balance go negative on a race.
            const debit = await tx.user.updateMany({
              where: { id: sub.userId, cashBalance: { gte: sub.amount } },
              data: { cashBalance: { decrement: sub.amount } },
            });
            if (debit.count === 0) throw new Error("INSUFFICIENT");

            await tx.user.update({
              where: { id: sub.userId },
              data: { packageId: sub.packageId, packageExpiresAt: newEnd },
            });
            await tx.subscription.update({
              where: { id: sub.id },
              data: { endDate: newEnd },
            });
            await tx.transaction.create({
              data: {
                userId: sub.userId,
                type: TransactionType.PURCHASE,
                status: TransactionStatus.COMPLETED,
                amount: -sub.amount,
                points: 0,
                description: "Subscription auto-renewal",
                reference: `sub_renew_${sub.id}_${newEnd.getTime()}`,
              },
            });
          });
          renewed++;
          void deliverToUser({
            userId: sub.userId,
            title: "Subscription renewed",
            message: `Your plan was auto-renewed for $${sub.amount.toFixed(2)}.`,
            link: "/my-package",
          });
          continue;
        } catch {
          // Balance moved / race — fall through and expire instead.
        }
      }

      // Expire the lapsed subscription. Only downgrade the user if their overall
      // entitlement has actually lapsed — a newer, still-valid subscription
      // leaves packageExpiresAt in the future, so we must not strip it.
      const entitlement = expiresById.get(sub.userId);
      const stillEntitled = entitlement != null && entitlement.getTime() > now.getTime();
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { isActive: false },
        }),
        ...(stillEntitled
          ? []
          : [
              prisma.user.update({
                where: { id: sub.userId },
                data: { packageId: fallback?.id ?? null, packageExpiresAt: null },
              }),
            ]),
      ]);
      expired++;
      void deliverToUser({
        userId: sub.userId,
        title: "Subscription expired",
        message:
          "Your premium plan has ended. Renew any time to restore your benefits.",
        link: "/packages",
      });
    }

    return NextResponse.json({ processed: due.length, renewed, expired });
  } catch (error) {
    console.error("Subscription expiry cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
