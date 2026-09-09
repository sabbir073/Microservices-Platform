import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recheckPendingSocialSubmissions } from "@/lib/social-recheck";

export const dynamic = "force-dynamic";

/**
 * "Has my submission been verified yet?"
 *
 * The page the user is already looking at after submitting calls this every few
 * seconds for a couple of minutes. A social page is often not readable at the
 * instant it is published, so the first check says "couldn't read this"; asking
 * again shortly after usually succeeds, and the user watches it turn green
 * rather than waiting on a reviewer.
 *
 * This is why the feature needs no scheduler. The cron route does the same work
 * for people who closed the tab; this does it for the person still watching.
 *
 * Only ever the caller's OWN submission — ownership is part of the query, not a
 * check afterwards. It only ever approves, never rejects (see lib/social-recheck).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.taskSubmission.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, metadata: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Already decided — nothing to do, and say so plainly so the page can stop
  // asking rather than polling a settled row forever.
  if (existing.status !== "PENDING") {
    return NextResponse.json({ status: existing.status, done: true });
  }

  // Cheap guard against a page (or a script) asking in a tight loop: each check
  // costs an outbound fetch to somebody else's site.
  const meta = (existing.metadata ?? {}) as { recheckedAt?: string };
  if (meta.recheckedAt && Date.now() - Date.parse(meta.recheckedAt) < 8000) {
    return NextResponse.json({ status: "PENDING", done: false, throttled: true });
  }

  const summary = await recheckPendingSocialSubmissions({
    submissionId: id,
    ownerUserId: session.user.id,
    limit: 1,
  });

  const after = await prisma.taskSubmission.findUnique({
    where: { id },
    select: { status: true },
  });
  return NextResponse.json({
    status: after?.status ?? "PENDING",
    done: after?.status !== "PENDING",
    approved: summary.approved > 0,
  });
}
