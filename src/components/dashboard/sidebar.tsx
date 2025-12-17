"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Wallet,
  Users,
  Gift,
  Trophy,
  GraduationCap,
  Store,
  Ticket,
  MessageSquare,
  Settings,
  Sparkles,
  LogOut,
  X,
  Shield,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { isAdmin, type UserRole } from "@/lib/rbac";

interface SidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: ListTodo },
  { name: "Wallet", href: "/wallet", icon: Wallet },
  { name: "Referrals", href: "/referrals", icon: Users },
  { name: "Earn", href: "/earn", icon: Gift },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Courses", href: "/courses", icon: GraduationCap },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Lottery", href: "/lottery", icon: Ticket },
  { name: "Social", href: "/social", icon: MessageSquare },
];

const bottomNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Admin Panel", href: "/admin", icon: Shield },
];

// Extract SidebarContent as a separate component
interface SidebarContentProps {
  user: SidebarProps["user"];
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
}

function SidebarContent({ user, pathname, onNavigate, onSignOut }: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            EarnGPT
          </span>
        </Link>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
            {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Admin Navigation - Show for all admin roles */}
      {isAdmin(user.role as UserRole | undefined) && (
        <div className="border-t border-gray-800 px-3 py-4">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Administration
          </p>
          <ul className="space-y-1">
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-red-500/10 text-red-400"
                        : "text-gray-400 hover:text-red-400 hover:bg-gray-800"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800 px-3 py-4">
        <ul className="space-y-1">
          {bottomNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const handleNavigate = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 transform transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col h-full">
          <SidebarContent
            user={user}
            pathname={pathname}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
          <SidebarContent
            user={user}
            pathname={pathname}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
          />
        </div>
      </div>

      {/* Mobile Menu Button - This is handled in Header component */}
    </>
  );
}

// Export mobile menu toggle for header
export function useMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, setIsOpen };
}
