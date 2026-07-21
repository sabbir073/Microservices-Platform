import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { isGeminiConfigured, generateText } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/system-settings";

const schema = z.object({ prompt: z.string().min(3).max(4000) });

/**
 * User-facing AI text generation — powers the "Generate with AI" button in the
 * social task run page (Write Review / Comment / Write Answer, …). Any signed-in
 * user can call it. Degrades to 503 when GEMINI_API_KEY is unset so the UI falls
 * back to writing manually.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const v = schema.safeParse(body);
  if (!v.success) {
    return NextResponse.json({ error: "A prompt is required" }, { status: 400 });
  }

  // Per-user daily rate limit (admin-configurable; -1/0 = unlimited).
  const limit = await getSetting<number>("ai.daily_limit_per_user", 50);
  if (typeof limit === "number" && limit > 0) {
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const existing = await prisma.aiUsageDaily.findUnique({
      where: { userId_dateKey: { userId: session.user.id, dateKey } },
      select: { count: true },
    });
    if ((existing?.count ?? 0) >= limit) {
      return NextResponse.json(
        {
          error: `Daily AI limit reached (${limit}/day). Try again tomorrow or write it yourself.`,
        },
        { status: 429 }
      );
    }
    await prisma.aiUsageDaily.upsert({
      where: { userId_dateKey: { userId: session.user.id, dateKey } },
      create: { userId: session.user.id, dateKey, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  const result = await generateText(v.data.prompt);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Generation failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ text: result.text });
}
