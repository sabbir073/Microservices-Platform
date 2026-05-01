import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ReferralsView,
  type ReferralUser,
} from "@/components/user/referrals/referrals-view";

export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referralCode: true, name: true },
  });
  if (!user) redirect("/login");

  const code =
    user.referralCode ?? `EARN${user.id.slice(0, 6).toUpperCase()}`;
  const shareUrl = `https://earngpt.com/register?ref=${code}`;

  // Build the 3-level team
  const l1 = await prisma.user.findMany({
    where: { referredById: userId },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const l1Ids = l1.map((u) => u.id);

  const l2 = l1Ids.length
    ? await prisma.user.findMany({
        where: { referredById: { in: l1Ids } },
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const l2Ids = l2.map((u) => u.id);

  const l3 = l2Ids.length
    ? await prisma.user.findMany({
        where: { referredById: { in: l2Ids } },
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Earnings via ReferralEarning + this-month total
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [allEarnings, thisMonthEarnings] = await Promise.all([
    prisma.referralEarning.findMany({
      where: { userId },
      select: { level: true, amount: true, referredUserId: true },
    }),
    prisma.referralEarning.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  // Aggregate per-user earnings (for the team list)
  const earningsByUser = new Map<string, number>();
  let l1Earned = 0;
  let l2Earned = 0;
  let l3Earned = 0;
  for (const e of allEarnings) {
    const amt = Number(e.amount ?? 0);
    if (e.level === 1) l1Earned += amt;
    else if (e.level === 2) l2Earned += amt;
    else if (e.level === 3) l3Earned += amt;
    earningsByUser.set(
      e.referredUserId,
      (earningsByUser.get(e.referredUserId) ?? 0) + amt
    );
  }

  const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const isActive = (lastLogin: Date | null) =>
    lastLogin ? nowMs - new Date(lastLogin).getTime() < ACTIVE_WINDOW_MS : false;

  const buildTeam = (
    rows: typeof l1,
    level: 1 | 2 | 3
  ): ReferralUser[] =>
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      level,
      joinedAt: u.createdAt.toISOString(),
      earnings: earningsByUser.get(u.id) ?? 0,
      isActive: isActive(u.lastLoginAt),
    }));

  const team: ReferralUser[] = [
    ...buildTeam(l1, 1),
    ...buildTeam(l2, 2),
    ...buildTeam(l3, 3),
  ];

  return (
    <ReferralsView
      referralCode={code}
      shareUrl={shareUrl}
      l1Count={l1.length}
      l2Count={l2.length}
      l3Count={l3.length}
      l1Earned={l1Earned}
      l2Earned={l2Earned}
      l3Earned={l3Earned}
      thisMonthEarned={Number(thisMonthEarnings._sum.amount ?? 0)}
      team={team}
    />
  );
}
