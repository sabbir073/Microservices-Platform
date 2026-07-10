"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
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
  ClipboardList,
  Brain,
  Send,
  Megaphone,
  Globe,
  Pin,
  Target,
  Award,
  Package,
  Briefcase,
  ArrowUpRight,
  HelpCircle,
  FileText,
  Video,
  Bell,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { isAdmin, isTutor, type UserRole } from "@/lib/rbac";

interface SidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

const navigationGroups = [
  {
    section: "Main",
    items: [
      { name: "Home", href: "/social", icon: Home },
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Tasks", href: "/tasks", icon: ListTodo },
      { name: "Daily Mission", href: "/daily-mission", icon: Target },
      { name: "Quizzes", href: "/quizzes", icon: Brain },
      { name: "Wallet", href: "/wallet", icon: Wallet },
      { name: "Referrals", href: "/referrals", icon: Users },
    ],
  },
  {
    section: "Earn",
    items: [
      { name: "Earn Hub", href: "/earn", icon: Gift },
      { name: "Manual Tasks", href: "/manual-tasks", icon: ClipboardList },
      { name: "Article Tasks", href: "/article-tasks", icon: FileText },
      { name: "Video Tasks", href: "/video-tasks", icon: Video },
      { name: "Quiz Tasks", href: "/quiz-tasks", icon: Brain },
      { name: "Survey Tasks", href: "/survey-tasks", icon: ClipboardCheck },
      { name: "Social Tasks", href: "/social-tasks", icon: Send },
      { name: "Social Posts", href: "/social-posts", icon: Megaphone },
      { name: "Proxy Tasks", href: "/proxy-tasks", icon: Globe },
      { name: "Board Tasks", href: "/board-tasks", icon: Pin },
      { name: "Watch & Earn", href: "/watch-ads", icon: Video },
      { name: "Milestones", href: "/milestones", icon: Target },
      { name: "Achievements", href: "/achievements", icon: Award },
      { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    ],
  },
  {
    section: "Grow",
    items: [
      { name: "Courses", href: "/courses", icon: GraduationCap },
      { name: "My Learning", href: "/my-learning", icon: GraduationCap },
      { name: "Marketplace", href: "/marketplace", icon: Store },
      { name: "Lottery", href: "/lottery", icon: Ticket },
      { name: "Packages", href: "/packages", icon: Package },
      { name: "Advertiser", href: "/advertiser", icon: Briefcase },
    ],
  },
  {
    section: "Account",
    items: [
      { name: "Add Funds", href: "/deposit", icon: CreditCard },
      { name: "Withdrawal", href: "/withdrawal", icon: ArrowUpRight },
      { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
      { name: "My Package", href: "/my-package", icon: Package },
      { name: "Notifications", href: "/notifications", icon: Bell },
      { name: "Chat", href: "/chat", icon: MessageSquare },
      { name: "Help", href: "/help", icon: HelpCircle },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const adminNavigation = [
  { name: "Admin Panel", href: "/admin", icon: Shield },
];

const tutorNavigation = [
  { name: "Tutor Hub", href: "/tutor/dashboard", icon: GraduationCap },
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
        <Link href="/social" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            EarnGPT
          </span>
        </Link>
      </div>

      {/* User Info */}
      <div className="px-3 py-3 border-b border-gray-800">
        <Link
          href="/profile"
          onClick={onNavigate}
          aria-label="Open profile"
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
            pathname.startsWith("/profile")
              ? "bg-indigo-500/10"
              : "hover:bg-gray-800"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
            {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium truncate",
                pathname.startsWith("/profile")
                  ? "text-indigo-400"
                  : "text-white"
              )}
            >
              {user.name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {navigationGroups.map((group) => (
          <div key={group.section}>
            <p className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              {group.section}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Tutor Navigation - Show for users with TUTOR role */}
      {isTutor(user.role as UserRole | undefined) && (
        <div className="border-t border-gray-800 px-3 py-4">
          <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Teaching
          </p>
          <ul className="space-y-1">
            {tutorNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-500/10 text-indigo-300"
                        : "text-gray-400 hover:text-indigo-300 hover:bg-gray-800"
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

      {/* Sign Out Button */}
      <div className="border-t border-gray-800 px-3 py-4">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
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
