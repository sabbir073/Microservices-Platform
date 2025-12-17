"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Wallet,
  Store,
  Settings,
  Shield,
  LogOut,
  X,
  BarChart3,
  Bell,
  Package,
  GitBranch,
  Globe,
  HelpCircle,
  Sparkles,
  ClipboardCheck,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  getAccessibleModules,
  ROLE_CONFIG,
  type Permission,
  hasPermission,
  type UserRole,
} from "@/lib/rbac";

interface AdminSidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

// Icon mapping for dynamic rendering
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  ListTodo,
  ClipboardCheck,
  Wallet,
  Store,
  Ticket,
  Package,
  GitBranch,
  Globe,
  HelpCircle,
  Sparkles,
  Bell,
  BarChart3,
  Settings,
  Shield,
};

// Extract SidebarContent as a separate component
interface AdminSidebarContentProps {
  user: AdminSidebarProps["user"];
  userRole: UserRole | undefined;
  accessibleModules: ReturnType<typeof getAccessibleModules>;
  roleConfig: (typeof ROLE_CONFIG)[keyof typeof ROLE_CONFIG];
  pathname: string;
  onNavigate: () => void;
  onSignOut: () => void;
}

function AdminSidebarContent({
  user,
  userRole,
  accessibleModules,
  roleConfig,
  pathname,
  onNavigate,
  onSignOut,
}: AdminSidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Admin Panel</span>
        </Link>
      </div>

      {/* Admin Info */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-medium">
            {user.name?.charAt(0) || user.email?.charAt(0) || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.name || "Admin"}
            </p>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                roleConfig.color,
                roleConfig.bgColor
              )}
            >
              {roleConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {accessibleModules.map((module) => {
            const Icon = iconMap[module.icon] || LayoutDashboard;
            const isActive =
              pathname === module.href ||
              (module.href !== "/admin" &&
                pathname.startsWith(`${module.href}/`));

            return (
              <li key={module.name}>
                <Link
                  href={module.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-red-500/10 text-red-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{module.name}</span>
                  {module.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded">
                      {module.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Super Admin Only: Audit Logs */}
        {hasPermission(userRole, "logs.view" as Permission) && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              System
            </p>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/admin/logs"
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === "/admin/logs"
                      ? "bg-red-500/10 text-red-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  <Shield className="w-5 h-5" />
                  Audit Logs
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800 px-3 py-4">
        <ul className="space-y-1">
          <li>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-indigo-400 hover:bg-gray-800 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5" />
              Back to App
            </Link>
          </li>
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

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userRole = user.role as UserRole | undefined;
  const accessibleModules = getAccessibleModules(userRole);
  const roleConfig = userRole ? ROLE_CONFIG[userRole] : ROLE_CONFIG.USER;

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
          <AdminSidebarContent
            user={user}
            userRole={userRole}
            accessibleModules={accessibleModules}
            roleConfig={roleConfig}
            pathname={pathname}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
          <AdminSidebarContent
            user={user}
            userRole={userRole}
            accessibleModules={accessibleModules}
            roleConfig={roleConfig}
            pathname={pathname}
            onNavigate={handleNavigate}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </>
  );
}
