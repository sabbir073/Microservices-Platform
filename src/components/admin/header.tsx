"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  Bell,
  Search,
  X,
  Shield,
  Settings,
  LogOut,
  User,
  ChevronDown,
  LayoutDashboard,
  Users,
  ListTodo,
  Wallet,
  Gift,
  GraduationCap,
  Store,
  Ticket,
  BarChart3,
  FileText,
  CreditCard,
  Check,
  AlertCircle,
  CheckCircle,
  Megaphone,
  Trophy,
  MessageSquare,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface AdminHeaderProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string }
> = {
  SYSTEM: { icon: AlertCircle, color: "text-gray-400" },
  TASK: { icon: CheckCircle, color: "text-blue-400" },
  WALLET: { icon: Wallet, color: "text-emerald-400" },
  REFERRAL: { icon: Users, color: "text-purple-400" },
  PROMOTION: { icon: Megaphone, color: "text-amber-400" },
  ACHIEVEMENT: { icon: Trophy, color: "text-yellow-400" },
  LOTTERY: { icon: Ticket, color: "text-pink-400" },
  SOCIAL: { icon: MessageSquare, color: "text-indigo-400" },
};

const mobileNavigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Tasks", href: "/admin/tasks", icon: ListTodo },
  { name: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
  { name: "Transactions", href: "/admin/transactions", icon: CreditCard },
  { name: "Referrals", href: "/admin/referrals", icon: Gift },
  { name: "Courses", href: "/admin/courses", icon: GraduationCap },
  { name: "Marketplace", href: "/admin/marketplace", icon: Store },
  { name: "Lottery", href: "/admin/lottery", icon: Ticket },
  { name: "Reports", href: "/admin/reports", icon: BarChart3 },
  { name: "Audit Logs", href: "/admin/logs", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminHeader({ user }: AdminHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications?limit=5&unread=true");
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (response.ok) {
        setUnreadCount(0);
        setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu Button & Logo (mobile only) */}
          <div className="flex items-center gap-4 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
            </Link>
          </div>

          {/* Center/Left: Search (desktop) */}
          <div className="hidden lg:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="search"
                placeholder="Search users, tasks..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Admin Badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
              <Shield className="w-4 h-4" />
              {user.role}
            </span>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsProfileOpen(false);
                }}
                className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-xs font-bold text-white bg-red-500 rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotificationOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 rounded-lg bg-gray-900 border border-gray-800 shadow-lg z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-white">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const typeConfig =
                            NOTIFICATION_TYPE_CONFIG[notif.type] ||
                            NOTIFICATION_TYPE_CONFIG.SYSTEM;
                          const Icon = typeConfig.icon;

                          return (
                            <Link
                              key={notif.id}
                              href="/admin/notifications"
                              onClick={() => setIsNotificationOpen(false)}
                              className={cn(
                                "block px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors",
                                !notif.isRead && "bg-red-500/5"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "p-1.5 rounded-lg bg-gray-800",
                                    typeConfig.color
                                  )}
                                >
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-white truncate">
                                      {notif.title}
                                    </p>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {formatTimeAgo(notif.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                    <Link
                      href="/admin/notifications"
                      onClick={() => setIsNotificationOpen(false)}
                      className="block px-4 py-3 text-center text-sm text-red-400 hover:text-red-300 border-t border-gray-800"
                    >
                      View all notifications
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationOpen(false);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-sm font-medium">
                  {user.name?.charAt(0) || user.email?.charAt(0) || "A"}
                </div>
                <ChevronDown className="hidden sm:block w-4 h-4 text-gray-400" />
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-lg bg-gray-900 border border-gray-800 shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-sm font-medium text-white truncate">
                        {user.name || "Admin"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Back to App
                      </Link>
                      <Link
                        href="/admin/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-gray-800 py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 transform transition-transform duration-300 lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
            <Link
              href="/admin"
              className="flex items-center gap-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Admin Panel
              </span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin Info */}
          <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-medium">
                {user.name?.charAt(0) || user.email?.charAt(0) || "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name || "Admin"}
                </p>
                <p className="text-xs text-red-400 truncate">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {mobileNavigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-red-500/10 text-red-400"
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

          {/* Bottom Actions */}
          <div className="border-t border-gray-800 px-3 py-4 space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-800 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              Back to App
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
