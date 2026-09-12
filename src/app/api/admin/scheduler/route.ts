import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { SCHEDULED_JOBS, findJob } from "@/lib/scheduler/jobs";
import { runJobNow } from "@/lib/scheduler/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Recent history for the admin screen. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "settings.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = (await prisma.scheduledJobRun.findMany({
    orderBy: { claimedAt: "desc" },
    take: 60,
    select: {
      id: true,
      job: true,
      windowKey: true,
      state: true,
      attempts: true,
      source: true,
      claimedAt: true,
      finishedAt: true,
      durationMs: true,
      summary: true,
      error: true,
    },
  })) as Array<{
    id: string;
    job: string;
    windowKey: string;
    state: string;
    attempts: number;
    source: string;
    claimedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    summary: string | null;
    error: string | null;
  }>;

  return NextResponse.json({
    jobs: SCHEDULED_JOBS.map((j) => ({
      name: j.name,
      label: j.label,
      description: j.description,
      intervalMs: j.intervalMs,
      leaseMs: j.leaseMs,
    })),
    runs: runs.map((r) => ({ ...r, claimedAt: r.claimedAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null })),
  });
}

const schema = z.object({ job: z.string().min(1) });

/** Run one job by hand. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "settings.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const v = schema.safeParse(await request.json().catch(() => null));
  if (!v.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const job = findJob(v.data.job);
  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  const line = await runJobNow(job.name);
  await writeAudit({
    actorId: session.user.id,
    action: "scheduler.run",
    entity: "ScheduledJobRun",
    entityId: job.name,
    summary: `Ran the "${job.label}" job by hand.`,
    meta: { ...line } as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true, line });
}
