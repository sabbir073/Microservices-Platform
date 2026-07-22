import { Prisma } from "@/generated/prisma/client";
import { AD_PLACEMENTS } from "@/lib/ad-placements";

/**
 * Minimal structural client type — satisfied by BOTH the app's Accelerate-
 * extended `prisma` and a plain `new PrismaClient()` in the seed script (their
 * concrete types differ, so a loose shape keeps this helper portable).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type DemoPrisma = {
  adPlacement: {
    upsert(args: any): Promise<any>;
    findMany(args?: any): Promise<any[]>;
  };
  adCampaign: {
    findFirst(args: any): Promise<any | null>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  ad: {
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Demo-ad generator shared by the admin "Generate demo ads" API route and the
 * `prisma/seed-demo-ads.ts` seed script. Creates one labeled preview ad for
 * every ad placement so the whole ad-space network is visibly populated (each
 * demo is a self-contained SVG data-URI — no external asset). Idempotent.
 */
export const DEMO_CAMPAIGN_TITLE = "DEMO — Ad Previews";

const LABELS = new Map<string, string>(
  AD_PLACEMENTS.map((p) => [p.name, p.label])
);
const PALETTE = [
  "#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706",
  "#db2777", "#dc2626", "#2563eb", "#0d9488", "#c026d3",
];

function demoBanner(label: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">` +
    `<rect width="600" height="200" fill="${color}"/>` +
    `<rect x="8" y="8" width="584" height="184" rx="14" fill="none" stroke="#ffffff40" stroke-width="2"/>` +
    `<text x="300" y="92" font-family="sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>` +
    `<text x="300" y="132" font-family="sans-serif" font-size="18" fill="#ffffffcc" text-anchor="middle">DEMO AD · click to preview</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function demoLogo(color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">` +
    `<rect width="80" height="80" rx="16" fill="${color}"/>` +
    `<text x="40" y="52" font-family="sans-serif" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">AD</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Create one labeled demo ad per placement. Returns how many were created. */
export async function generateDemoAds(
  prisma: DemoPrisma
): Promise<{ created: number; total: number }> {
  // Ensure every canonical placement row exists (incl. new global slots).
  await Promise.all(
    AD_PLACEMENTS.map((p) =>
      prisma.adPlacement.upsert({
        where: { name: p.name },
        create: { name: p.name, platform: "ALL", isActive: true },
        update: {},
      })
    )
  );

  // Funded + ACTIVE so /api/ads/serve + /api/ads/feed actually pick these.
  const budget = 100000;
  let campaign = await prisma.adCampaign.findFirst({
    where: { title: DEMO_CAMPAIGN_TITLE },
  });
  if (!campaign) {
    campaign = await prisma.adCampaign.create({
      data: {
        title: DEMO_CAMPAIGN_TITLE,
        description: "Auto-generated preview ads — one per ad space.",
        budget,
        status: "ACTIVE",
      },
    });
  } else if (campaign.status !== "ACTIVE" || campaign.budget < budget) {
    campaign = await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE", budget },
    });
  }

  const placements = await prisma.adPlacement.findMany();
  const existing = await prisma.ad.findMany({
    where: { campaignId: campaign.id },
    select: { placementId: true },
  });
  const covered = new Set(existing.map((a) => a.placementId));

  let created = 0;
  await Promise.all(
    placements.map((placement, i) => {
      if (covered.has(placement.id)) return Promise.resolve();
      const label = LABELS.get(placement.name) ?? placement.name;
      const color = PALETTE[i % PALETTE.length];
      const isFeed = placement.name === "IN_FEED";
      created += 1;
      return prisma.ad.create({
        data: {
          campaignId: campaign!.id,
          placementId: placement.id,
          type: "LOCAL",
          format: isFeed ? "NATIVE" : "BANNER",
          status: "ACTIVE",
          weight: 10,
          contentUrl: demoBanner(label, color),
          targetUrl: "#demo",
          size: "responsive",
          targeting: Prisma.JsonNull, // everyone
          ...(isFeed
            ? {
                headline: `Demo native ad — ${label}`,
                brandName: "DEMO Brand",
                brandLogo: demoLogo(color),
                ctaLabel: "Learn More",
              }
            : {}),
        },
      });
    })
  );

  return { created, total: placements.length };
}

/** Delete the demo campaign (cascades to its demo ads). */
export async function removeDemoAds(
  prisma: DemoPrisma
): Promise<{ removed: number }> {
  const res = await prisma.adCampaign.deleteMany({
    where: { title: DEMO_CAMPAIGN_TITLE },
  });
  return { removed: res.count };
}
