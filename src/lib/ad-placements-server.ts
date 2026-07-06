import { prisma } from "@/lib/prisma";
import { AD_PLACEMENTS } from "@/lib/ad-placements";

/** Idempotently ensure every canonical placement row exists (active). Server-only. */
export async function ensureDefaultPlacements() {
  await Promise.all(
    AD_PLACEMENTS.map((p) =>
      prisma.adPlacement.upsert({
        where: { name: p.name },
        create: { name: p.name, platform: "ALL", isActive: true },
        update: {},
      })
    )
  );
}
