"use client";

import Link from "next/link";
import {
  CalendarCheck,
  ListTodo,
  Store,
  Wallet,
  Users,
  Trophy,
} from "lucide-react";
import { ScrollFadeRow } from "@/components/user/primitives/scroll-fade-row";

/**
 * The six places people actually go, sitting in the feed toolbar.
 *
 * The toolbar's left half was empty whenever Groups is off — the tab list hides
 * itself when one tab is not a choice — so the row that is always on screen,
 * always in reach, was carrying nothing. Meanwhile Daily Mission, Tasks, Wallet
 * and the rest were a drawer away on a phone.
 *
 * Icon-first and horizontally scrollable, like a mobile app's shortcut row,
 * rather than a second navigation menu: these are jumps, not a hierarchy. The
 * labels stay visible from `sm` up where there is room for them; below that the
 * icon carries it and the label is still in the accessible name.
 *
 * Wrapped in `ScrollFadeRow` so the edge fades while there is more to reach —
 * the same fix applied to every other scrolling row on the platform, because a
 * row that scrolls with no sign that it scrolls is a row whose right-hand items
 * nobody ever finds.
 */

/* Six shortcuts, ONE colour.
   This row is the exact thing the owner screenshotted: an amber Daily, an
   indigo Tasks, an emerald Market, a sky Wallet, a violet Team and a rose
   Ranks, six saturated hues in 300px, none of which carried any meaning — the
   colour was decoration assigned in the order the links were written. Squinting
   at it gave you six equally loud dots and no idea which one mattered.
   They are neutral now and read as one row of six peers, which is what they
   are; where you are is carried by the page you are on. */
const LINKS = [
  {
    href: "/daily-mission",
    label: "Daily Mission",
    short: "Daily",
    icon: CalendarCheck,
  },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  {
    href: "/marketplace",
    label: "Marketplace",
    short: "Market",
    icon: Store,
  },
  { href: "/wallet", label: "Wallet", short: "Wallet", icon: Wallet },
  { href: "/referrals", label: "My Team", short: "Team", icon: Users },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    short: "Ranks",
    icon: Trophy,
  },
] as const;

export function FeedQuickLinks({
  hidden = new Set<string>(),
  className = "",
}: {
  /**
   * Paths this user may not see. Page visibility is a per-user admin grant, so
   * a shortcut to a page they would be bounced off is worse than no shortcut —
   * it reads as the platform being broken rather than as a setting.
   */
  hidden?: Set<string>;
  className?: string;
}) {
  const visible = LINKS.filter((l) => !hidden.has(l.href));
  if (visible.length === 0) return null;

  return (
    <ScrollFadeRow className={`min-w-0 flex-1 ${className}`}>
      <div className="flex items-center gap-1">
        {visible.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            title={l.label}
            // 44px, written on the element itself — the toolbar's other
            // controls match, and a shortcut row on a phone is pure tap target.
            className="app-tap app-press inline-flex shrink-0 items-center gap-1.5 rounded-(--app-r-chip) px-2.5 text-xs font-bold text-gray-300 hover:bg-(--app-surface-2) hover:text-white"
          >
            <l.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden sm:inline">{l.short}</span>
          </Link>
        ))}
      </div>
    </ScrollFadeRow>
  );
}
