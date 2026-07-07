"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ListTodo, Wallet, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/lib/stores/mobile-nav-store";

const TABS = [
  { name: "Home", href: "/social", icon: Home },
  { name: "Tasks", href: "/tasks", icon: ListTodo },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Alerts", href: "/notifications", icon: Bell, badge: true },
] as const;

/** App-style fixed bottom navigation for mobile (hidden on lg+). */
export function BottomTabBar() {
  const pathname = usePathname();
  const setMenuOpen = useMobileNav((s) => s.setOpen);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/notifications?limit=1&unread=true")
      .then((r) => r.json())
      .then((d) => {
        if (active) setUnread(d.unreadCount || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-800 bg-gray-900/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const activeTab = isActive(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium relative",
                activeTab ? "text-indigo-400" : "text-gray-400"
              )}
            >
              <span className="relative">
                <tab.icon className="w-5 h-5" />
                {"badge" in tab && tab.badge && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4 text-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {tab.name}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-400"
        >
          <Menu className="w-5 h-5" />
          Menu
        </button>
      </div>
    </nav>
  );
}
