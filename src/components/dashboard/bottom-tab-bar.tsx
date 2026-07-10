"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Home, ListTodo, Wallet, Target, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/lib/stores/mobile-nav-store";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { haptic } from "@/lib/haptics";

// Left → right: two smaller page tabs, the bigger center Home, then Wallet + Menu.
const TABS = [
  { name: "Mission", href: "/daily-mission", icon: Target },
  { name: "Tasks", href: "/tasks", icon: ListTodo },
  { name: "Home", href: "/social", icon: Home, primary: true },
  { name: "Wallet", href: "/wallet", icon: Wallet },
] as const;

/** App-style fixed bottom navigation for mobile (hidden on lg+). */
export function BottomTabBar() {
  const pathname = usePathname();
  const setMenuOpen = useMobileNav((s) => s.setOpen);
  const [unread, setUnread] = useState(0);

  // Fetch unread on mount + on focus/timer (not on every navigation).
  const loadUnread = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?limit=1&unread=true", {
        cache: "no-store",
      });
      const d = await r.json();
      setUnread(d.unreadCount || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUnread();
  }, [loadUnread]);

  useAutoRefresh(loadUnread);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-800 bg-gray-900/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-center">
        {TABS.map((tab) => {
          const activeTab = isActive(tab.href);
          const primary = "primary" in tab && tab.primary;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              onClick={() => haptic("light")}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-transform active:scale-95",
                activeTab ? "text-indigo-400" : "text-gray-400"
              )}
            >
              {primary ? (
                // Center Home: bigger icon inside a subtle rounded highlight.
                <span
                  className={cn(
                    "flex items-center justify-center w-11 h-11 rounded-full transition-colors",
                    activeTab
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "bg-gray-800/60 text-gray-300"
                  )}
                >
                  <tab.icon className="w-7 h-7" />
                </span>
              ) : (
                <tab.icon className="w-5 h-5" />
              )}
              <span className={cn(primary && "mt-0.5")}>{tab.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            haptic("light");
            setMenuOpen(true);
          }}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-400 transition-transform active:scale-95"
        >
          <span className="relative">
            <Menu className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4 text-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          Menu
        </button>
      </div>
    </nav>
  );
}
