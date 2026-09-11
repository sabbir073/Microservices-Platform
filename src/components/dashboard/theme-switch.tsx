"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Light/dark switch for the in-app shell.
 *
 * Separate from `components/landing/theme-toggle.tsx` on purpose: that one
 * flips `data-mk-theme` on the marketing root and is deliberately isolated
 * from the dashboard, so a visitor's choice on the landing page does not
 * follow them into the app. This one drives the real app theme through
 * `useTheme()`.
 *
 * It lives in the header rather than only in Settings because a theme is
 * something people change on a whim — in a dark room, in sunlight — and a
 * control buried three taps deep is one they will not find when they want it.
 * The user header had no toggle at all; the admin header did.
 *
 * "system" is a real stored value, so pressing this resolves it to whichever
 * side the user is NOT currently looking at, rather than assuming dark.
 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  // `theme` may be "system"; ask the document what actually got applied so the
  // icon never contradicts the screen.
  const resolved =
    theme === "system"
      ? typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark"
      : theme;
  const isLight = resolved === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
      className={
        className ||
        // 40px so it is a real tap target on a phone, not a decorative icon.
        "inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
      }
    >
      {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
