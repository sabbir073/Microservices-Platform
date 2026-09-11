import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userCanFeature } from "@/lib/packages";
import { estimateReach } from "@/lib/buyer-reach";
import { sanitizeTaskAudience, EMPTY_TASK_AUDIENCE } from "@/lib/task-targeting";
import { getBuyerSettings } from "@/lib/buyer-settings";

/**
 * What a buyer is about to buy, BEFORE they buy it.
 *
 * The create form let someone pick a country, an age window and a minimum level
 * and press Create with no idea whether that described forty thousand people or
 * nobody at all — and a task matching nobody looks exactly like a task nobody
 * has got to yet, so the mistake was invisible until they gave up on it.
 *
 * POST rather than GET because the audience is nine arrays; serialising those
 * into a query string is how the estimate and the create call end up disagreeing
 * about what was targeted. The body is the SAME shape `/api/tasks/create`
 * accepts and it is run through the SAME `sanitizeTaskAudience`, so what is
 * counted here is what will be served.
 *
 * Read-only: nothing is created, charged or reserved.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Same gate as creating: this counts platform-wide user numbers, so it is not
  // something any signed-in account gets to probe.
  if (!(await userCanFeature(userId, "createTasks"))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Targeting is a granted capability. Without it the create route strips the
  // audience, so estimating against one here would quote a reach the task will
  // never have.
  const audience = (await userCanFeature(userId, "targetTasks"))
    ? sanitizeTaskAudience(body)
    : EMPTY_TASK_AUDIENCE;

  const buyer = await getBuyerSettings();
  const minLevel = Math.max(1, Math.floor(Number(body.minLevel) || 1));
  const completions = Math.min(
    buyer.maxCompletions,
    Math.max(1, Math.floor(Number(body.targetCount) || 1))
  );
  const pointsReward = Math.max(0, Math.floor(Number(body.pointsReward) || 0));
  const type = String(body.type ?? "CUSTOM").toUpperCase();
  if (!buyer.allowedTaskTypes.includes(type)) {
    return NextResponse.json({ error: "Unknown task type" }, { status: 400 });
  }

  const estimate = await estimateReach({
    // `TaskAudienceInput` is the persisted shape, field for field — the same
    // nine columns `TaskAudience` reads back off a Task row.
    audience,
    minLevel,
    type,
    completions,
    pointsReward,
  });

  return NextResponse.json(estimate);
}
