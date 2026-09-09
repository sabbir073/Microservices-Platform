import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { recheckPendingSocialSubmissions } from "@/lib/social-recheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Re-check social submissions that could not be read the first time.
 *
 * A pin or post is often not ready the instant it is published, so the first
 * verification says "couldn't read this" and the submission waits for a human.
 * Running this a minute or two later picks up the ones that have since become
 * readable and approves them. It NEVER rejects — see `lib/social-recheck`.
 *
 * Two ways in, because this has to work whatever hosting is in front of it:
 *  - a scheduler, with `CRON_SECRET` as a bearer token or `?key=`
 *  - an admin, from the submissions screen, with `submissions.review`
 *
 * With no `CRON_SECRET` set the scheduled route is refused rather than left
 * open — an unauthenticated endpoint that pays people is not something to
 * default to on.
 */
async function authorise(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (bearer === `Bearer ${secret}` || key === secret) return true;
  }
  const session = await auth();
  if (session?.user?.id && (await can(session.user.id, "submissions.approve"))) {
    return true;
  }
  return false;
}

async function run(req: NextRequest) {
  if (!(await authorise(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const summary = await recheckPendingSocialSubmissions({
    limit: Number(sp.get("limit")) || undefined,
    minAgeSec: Number(sp.get("minAgeSec")) || undefined,
    maxAgeHours: Number(sp.get("maxAgeHours")) || undefined,
  });
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
