/**
 * Catalog of configurable feed-sidebar (right rail) widgets. Admin picks which
 * are enabled + their order (drag-and-drop) in Settings → Feed Widgets; the
 * order/enablement is stored in one SystemSetting row `feed.sidebar_widgets`
 * and read by the social page. The footer is always shown and is NOT listed
 * here. Client-safe (no prisma import) — imported by both the admin form and
 * the rail component.
 */
/**
 * Which band of the rail a widget belongs to.
 *
 * The rail stacked nine cards in one unbroken column — measured at 2423px of
 * widgets in a 666px window. Everything was visible and nothing was findable,
 * which is the complaint. Grouping gives the column three labelled bands with a
 * heading you can collapse, so the eye lands on "Discover" instead of scanning
 * nine card titles.
 *
 * `ad` is its own band and holds exactly one widget for a reason — see
 * RAIL_GROUPS below.
 */
export type FeedWidgetGroup = "ad" | "earn" | "discover" | "more";

export interface FeedWidgetDef {
  id: string;
  label: string;
  description: string;
  group: FeedWidgetGroup;
}

/** One entry per configurable widget, in the default (shipped) order. */
export const FEED_WIDGETS: FeedWidgetDef[] = [
  { id: "sponsored", label: "Sponsored Ad", description: "Ad from the FEED_SIDEBAR ad space (hidden for ad-free users).", group: "ad" },
  { id: "earnStreak", label: "Balance & Streak", description: "Points balance, today's earnings and the daily-reward claim.", group: "earn" },
  { id: "dailyMission", label: "Daily Mission", description: "Progress bar toward today's mission.", group: "earn" },
  { id: "quickEarn", label: "Quick Earn", description: "Shortcut tiles to watch-ads, tasks, games, lottery, offers.", group: "earn" },
  { id: "referral", label: "Refer & Earn", description: "Referral code + copy link + referral count.", group: "earn" },
  { id: "topEarners", label: "Top Earners", description: "Leaderboard of the highest earners.", group: "discover" },
  { id: "whoToFollow", label: "Who to Follow", description: "Suggested users to follow.", group: "discover" },
  { id: "trending", label: "Trending Hashtags", description: "Currently trending hashtags.", group: "discover" },
  { id: "promo", label: "Promotion", description: "Banner-driven promo / upgrade card.", group: "more" },
];

export interface FeedWidgetGroupDef {
  id: FeedWidgetGroup;
  label: string;
  /** Collapsible groups remember their state per viewer; the ad band does not. */
  collapsible: boolean;
}

/**
 * The bands, in the order they stack down the rail.
 *
 * The Sponsored ad is `collapsible: false` and sits in a band of its own, ABOVE
 * the collapsible ones. It is revenue: a group header the viewer can shut would
 * be a one-tap way to stop the FEED_SIDEBAR space ever being served, and an
 * impression that never renders is an impression nobody is paid for. Collapsing
 * "Discover" costs a suggestion; collapsing an ad costs money.
 */
export const RAIL_GROUPS: FeedWidgetGroupDef[] = [
  { id: "ad", label: "Sponsored", collapsible: false },
  { id: "earn", label: "Your earnings", collapsible: true },
  { id: "discover", label: "Discover", collapsible: true },
  { id: "more", label: "More", collapsible: true },
];

const GROUP_BY_ID = new Map(FEED_WIDGETS.map((w) => [w.id, w.group]));

/**
 * The band a widget id belongs to.
 *
 * Admin-created custom widgets are not in the catalog and land in "More" —
 * never in "Sponsored", so a custom widget can never be mistaken for paid
 * inventory or inherit the ad band's no-collapse rule.
 */
export function widgetGroupOf(id: string): FeedWidgetGroup {
  return GROUP_BY_ID.get(id) ?? "more";
}

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
