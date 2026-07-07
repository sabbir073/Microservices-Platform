import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SPLASH_SETTING_KEY,
  normalizeSplashConfig,
} from "@/lib/splash";

/** Public: splash config for the client. Returns {enabled:false} when off/empty. */
export async function GET() {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SPLASH_SETTING_KEY },
    });
    const cfg = normalizeSplashConfig(row?.value);
    const usableSlides = cfg.slides.filter((s) => s.title || s.content || s.imageUrl);
    if (!cfg.enabled || usableSlides.length === 0) {
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({
      enabled: true,
      durationMs: cfg.durationMs,
      frequency: cfg.frequency,
      slides: usableSlides,
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
