import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { DailyMissionsClient } from "@/components/admin/daily-missions/daily-missions-client";

export default async function DailyMissionsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "missions.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "missions.manage");

  const raw = await prisma.dailyMissionTemplate.findMany({
    orderBy: [{ packageTier: "asc" }, { order: "asc" }, { createdAt: "desc" }],
    include: {
      items: { orderBy: { order: "asc" } },
      _count: { select: { claims: true } },
    },
  });
  type ItemRow = {
    id: string;
    taskType: string;
    description: string | null;
    targetCount: number;
    xpPerComplete: number;
    pointsPerComplete: number;
    duration: number | null;
    requiredLevel: number | null;
    order: number;
  };
  type WithRels = (typeof raw)[number] & {
    items: ItemRow[];
    _count: { claims: number };
  };
  const missions = raw as WithRels[];

  return (
    <DailyMissionsClient
      initial={missions.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        packageTier: m.packageTier,
        requiredLevel: m.requiredLevel,
        completionXpReward: m.completionXpReward,
        completionPointsReward: m.completionPointsReward,
        isActive: m.isActive,
        autoRefresh: m.autoRefresh,
        linkReferralBonus: m.linkReferralBonus,
        order: m.order,
        claimsCount: m._count.claims,
        items: m.items.map((it) => ({
          id: it.id,
          taskType: it.taskType as
            | "ARTICLE"
            | "VIDEO"
            | "QUIZ"
            | "SURVEY"
            | "SOCIAL"
            | "PROXY"
            | "OFFERWALL"
            | "BOARD"
            | "MANUAL"
            | "CUSTOM",
          description: it.description,
          targetCount: it.targetCount,
          xpPerComplete: it.xpPerComplete,
          pointsPerComplete: it.pointsPerComplete,
          duration: it.duration,
          requiredLevel: it.requiredLevel,
          order: it.order,
        })),
      }))}
      canManage={canManage}
    />
  );
}
