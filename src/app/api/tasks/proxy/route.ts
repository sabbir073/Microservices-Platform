import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackageTier, TaskStatus, TaskType } from "@/generated/prisma/client";

const TIER_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  ELITE: 3,
  VIP: 4,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { level: true, packageTier: true, country: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const allowedTiers = (Object.entries(TIER_ORDER) as [PackageTier, number][])
    .filter(([, order]) => order <= TIER_ORDER[user.packageTier])
    .map(([t]) => t);

  const tasks = await prisma.task.findMany({
    where: {
      type: TaskType.PROXY,
      status: TaskStatus.ACTIVE,
      minLevel: { lte: user.level },
      requiredPackage: { in: allowedTiers },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      pointsReward: t.pointsReward,
      duration: t.duration ?? 5,
      country: t.countries[0] ?? user.country ?? "Worldwide",
      serverHost: undefined,
      serverPort: undefined,
    })),
  });
}
