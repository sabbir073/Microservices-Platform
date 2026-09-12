import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LANDING_CONTENT,
  LANDING_SETTING_KEY_PREFIX,
  isSectionKey,
  withEarnCardLinks,
  withRequiredNavLinks,
  type LandingContent,
  type SectionKey,
} from "@/lib/landing-content";

/**
 * Reads all SystemSetting rows under category=landing and merges their
 * values onto DEFAULT_LANDING_CONTENT. Unknown keys are ignored. Missing
 * keys fall back to defaults.
 *
 * Server-only — keeps prisma out of the client bundle.
 */
export async function getLandingContent(): Promise<LandingContent> {
  const merged: LandingContent = structuredClone(DEFAULT_LANDING_CONTENT);
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { category: "landing" },
      // Landing/marketing pages read this on every render; changes are rare and
      // admin edits already call invalidateSettingsCache — cache at the edge.
      cacheStrategy: { ttl: 60, swr: 120 },
    });
    for (const row of rows) {
      if (!row.key.startsWith(LANDING_SETTING_KEY_PREFIX)) continue;
      const section = row.key.slice(LANDING_SETTING_KEY_PREFIX.length);
      if (!isSectionKey(section)) continue;
      const v = row.value;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // Shallow merge so partial saves don't wipe added defaults from later
        // releases (e.g. a new field on hero).
        const next = { ...merged[section], ...(v as object) };
        (merged as Record<SectionKey, unknown>)[section] = next;
      }
    }
  } catch {
    // DB unreachable at build / preview time — fall back to defaults.
  }
  // A stored section REPLACES the default array it came from, so a marketing
  // page added after the admin last saved the navbar would never appear in the
  // menu, and an earn card saved before it had a destination would stay dead.
  // Reconcile both against the routes that actually exist. Anything the admin
  // has set by hand is left alone.
  merged.navbar = withRequiredNavLinks(merged.navbar);
  merged.features = withEarnCardLinks(merged.features);
  return merged;
}
