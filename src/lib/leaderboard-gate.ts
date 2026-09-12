import "server-only";
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/system-settings";

/**
 * The Leaderboard feature switch (`lb_enabled`), enforced on the server.
 *
 * The switch has existed in /admin/leaderboard since the settings form was
 * written, and until now it was saved and read by nothing at all: an admin
 * could turn the leaderboard "off", see the checkbox stay unticked, and the
 * board carried on serving every user. Hiding the nav entry alone would not
 * have fixed it either — `/api/leaderboard` answers anyone with a saved
 * request, and `/leaderboard` answers anyone with a bookmark.
 *
 * So it is one shared guard, the same shape as `groupsDisabled`, used by the
 * page, the API and the nav-hiding resolver:
 *
 *     const off = await leaderboardDisabled();
 *     if (off) return off;
 *
 * Defaults to ON when the row is missing or unreadable. This is a display
 * feature, not a money gate — a settings blip must not take a working board
 * away from everyone.
 */
const KEY = "lb_enabled";

function asBool(v: unknown, fallback: boolean): boolean {
  // Settings are stored as raw JSON booleans here, but tolerate the { v: … }
  // wrapper the older settings writers used.
  const unwrapped =
    v && typeof v === "object" && "v" in (v as object)
      ? (v as { v: unknown }).v
      : v;
  if (typeof unwrapped === "boolean") return unwrapped;
  if (unwrapped === "true") return true;
  if (unwrapped === "false") return false;
  return fallback;
}

/** The switch, for pages, server components and the nav resolver. */
export async function isLeaderboardEnabled(): Promise<boolean> {
  try {
    return asBool(await getSetting<unknown>(KEY, null), true);
  } catch {
    return true;
  }
}

/** Returns a 403 when the leaderboard is off, or `null` to continue. */
export async function leaderboardDisabled(): Promise<NextResponse | null> {
  if (await isLeaderboardEnabled()) return null;
  return NextResponse.json(
    { error: "The leaderboard is currently unavailable." },
    { status: 403 }
  );
}
