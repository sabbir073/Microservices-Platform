import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveFeatures } from "@/lib/packages";
import { getPointsPerUsd } from "@/lib/economy";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { BuyPointsView } from "@/components/user/buyer/buy-points-view";
import { toNum } from "@/lib/money";

/**
 * Turn wallet cash into task credit.
 *
 * Deliberately its own page rather than a step inside task creation: a buyer
 * usually tops up once and then runs several tasks from the same pot, and
 * making them think about money every time they write a task is how a task
 * never gets written.
 */
export default async function BuyPointsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const { enabled } = await getEffectiveFeatures(userId);
  if (!enabled.has("createTasks")) {
    return <FeatureLock title="Task Credit" applyHref="/profile/become-creator" />;
  }

  const [buyer, pointsPerUsd, me] = await Promise.all([
    getBuyerSettings(),
    getPointsPerUsd(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true, taskCreditPoints: true },
    }),
  ]);

  if (!buyer.enabled) {
    return (
      <FeatureLock
        title="Task Credit"
        message="Buyer task creation is turned off at the moment, so there is nothing to spend task credit on yet. Please check back later."
      />
    );
  }

  return (
    <BuyPointsView
      cashBalance={toNum(me?.cashBalance ?? 0)}
      taskCredit={me?.taskCreditPoints ?? 0}
      pointsPerUsd={pointsPerUsd}
      minPoints={buyer.minPurchasePoints}
      maxPoints={buyer.maxPurchasePoints}
    />
  );
}
