import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackageTier, TaskStatus, TaskType } from "@/generated/prisma/client";
import type { SocialConfig } from "@/lib/social-tasks";

const TIER_ORDER: Record<PackageTier, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  ELITE: 3,
  VIP: 4,
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "available";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, level: true, packageTier: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // For non-"available", look up the user's submissions for SOCIAL tasks
  if (status !== "available") {
    const statusMap: Record<string, "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"> = {
      submitted: "PENDING",
      in_progress: "PENDING",
      approved: "APPROVED",
      rejected: "REJECTED",
      expired: "EXPIRED",
    };
    const subStatus = statusMap[status];
    const submissions = await prisma.taskSubmission.findMany({
      where: {
        userId: user.id,
        ...(subStatus === "EXPIRED"
          ? { task: { type: TaskType.SOCIAL, expiresAt: { lt: new Date() } } }
          : { status: subStatus, task: { type: TaskType.SOCIAL } }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const taskIds = [...new Set(submissions.map((s) => s.taskId))];
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
    });
    return NextResponse.json({
      tasks: tasks.map((t) => mapTask(t)),
    });
  }

  // Available
  const allowedTiers = (Object.entries(TIER_ORDER) as [PackageTier, number][])
    .filter(([, order]) => order <= TIER_ORDER[user.packageTier])
    .map(([t]) => t);

  const tasks = await prisma.task.findMany({
    where: {
      type: TaskType.SOCIAL,
      status: TaskStatus.ACTIVE,
      minLevel: { lte: user.level },
      requiredPackage: { in: allowedTiers },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    tasks: tasks.map((t) => mapTask(t)),
  });
}

function mapTask(t: {
  id: string;
  title: string;
  description: string;
  pointsReward: number;
  difficulty: string;
  socialPlatform: string | null;
  socialAction: string | null;
  socialUrl: string | null;
  socialConfig: unknown;
  instructions: string | null;
  instructionVideoUrl: string | null;
}) {
  const cfg = (t.socialConfig as SocialConfig | null) ?? null;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    pointsReward: t.pointsReward,
    difficulty: t.difficulty,
    platform: (cfg?.platform ?? t.socialPlatform ?? "FACEBOOK").toUpperCase(),
    action: (cfg?.action ?? t.socialAction ?? "FOLLOW").toUpperCase(),
    targetUrl:
      cfg?.fields?.targetUrl ??
      cfg?.fields?.targetHandle ??
      t.socialUrl ??
      "",
    proofRequirements: cfg?.proofRequirements ?? {
      url: true,
      screenshot: true,
      username: false,
    },
    aiPromptEnabled: cfg?.aiPromptEnabled ?? false,
    aiPrompt: cfg?.aiPrompt ?? null,
    fields: cfg?.fields ?? {},
    instructions: t.instructions,
    instructionVideoUrl: t.instructionVideoUrl,
  };
}
