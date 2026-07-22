/**
 * Catalog of configurable feed-sidebar (right rail) widgets. Admin picks which
 * are enabled + their order (drag-and-drop) in Settings → Feed Widgets; the
 * order/enablement is stored in one SystemSetting row `feed.sidebar_widgets`
 * and read by the social page. The footer is always shown and is NOT listed
 * here. Client-safe (no prisma import) — imported by both the admin form and
 * the rail component.
 */
export interface FeedWidgetDef {
  id: string;
  label: string;
  description: string;
}

/** One entry per configurable widget, in the default (shipped) order. */
export const FEED_WIDGETS: FeedWidgetDef[] = [
  { id: "sponsored", label: "Sponsored Ad", description: "Ad from the FEED_SIDEBAR ad space (hidden for ad-free users)." },
  { id: "earnStreak", label: "Balance & Streak", description: "Points balance, today's earnings and the daily-reward claim." },
  { id: "dailyMission", label: "Daily Mission", description: "Progress bar toward today's mission." },
  { id: "quickEarn", label: "Quick Earn", description: "Shortcut tiles to watch-ads, tasks, games, lottery, offers." },
  { id: "referral", label: "Refer & Earn", description: "Referral code + copy link + referral count." },
  { id: "topEarners", label: "Top Earners", description: "Leaderboard of the highest earners." },
  { id: "whoToFollow", label: "Who to Follow", description: "Suggested users to follow." },
  { id: "trending", label: "Trending Hashtags", description: "Currently trending hashtags." },
  { id: "promo", label: "Promotion", description: "Banner-driven promo / upgrade card." },
];

export type FeedWidgetConfig = { id: string; enabled: boolean }[];

/** Default config — every widget enabled, in the catalog order. */
export const DEFAULT_WIDGET_CONFIG: FeedWidgetConfig = FEED_WIDGETS.map((w) => ({
  id: w.id,
  enabled: true,
}));

const BUILTIN_IDS = new Set(FEED_WIDGETS.map((w) => w.id));

/**
 * Reconcile a stored config with the catalog: keep valid saved entries in their
 * saved order, drop unknown ids, and append any catalog widgets missing from
 * the saved config (newly added widgets) as enabled. Guarantees every current
 * widget appears exactly once. `extraIds` are admin-created custom-widget ids
 * that are also valid (positioned/toggled alongside the built-ins).
 */
export function normalizeWidgetConfig(
  raw: unknown,
  extraIds: string[] = []
): FeedWidgetConfig {
  const arr = Array.isArray(raw) ? raw : [];
  const extra = new Set(extraIds);
  const seen = new Set<string>();
  const out: FeedWidgetConfig = [];
  for (const item of arr) {
    const id = (item as { id?: unknown })?.id;
    if (typeof id !== "string" || seen.has(id)) continue;
    if (!BUILTIN_IDS.has(id) && !extra.has(id)) continue; // drop unknown/removed
    seen.add(id);
    out.push({ id, enabled: (item as { enabled?: unknown }).enabled !== false });
  }
  // Append built-in widgets missing from the saved config (new widgets).
  for (const w of FEED_WIDGETS) {
    if (!seen.has(w.id)) out.push({ id: w.id, enabled: true });
  }
  // Append custom widgets not yet in the order (newly added).
  for (const id of extraIds) {
    if (!seen.has(id)) out.push({ id, enabled: true });
  }
  return out;
}
