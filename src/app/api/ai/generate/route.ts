import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { isGeminiConfigured, generateText } from "@/lib/gemini";

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

  const result = await generateText(v.data.prompt);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Generation failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ text: result.text });
}
