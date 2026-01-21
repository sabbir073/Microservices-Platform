// RBAC (Role-Based Access Control) Configuration
// Based on ADMIN_DASHBOARD_SPECS.md

// Note: We define UserRole locally for client components
// This should match the enum in prisma/schema.prisma
export type UserRole =
  | "USER"
  | "SUPER_ADMIN"
  | "FINANCE_ADMIN"
  | "CONTENT_ADMIN"
  | "SUPPORT_ADMIN"
  | "MARKETING_ADMIN"
  | "MODERATOR";

// Admin roles that have access to admin panel
export const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "CONTENT_ADMIN",
  "SUPPORT_ADMIN",
  "MARKETING_ADMIN",
  "MODERATOR",
];

// String array version for client components
export const ADMIN_ROLE_STRINGS = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "CONTENT_ADMIN",
  "SUPPORT_ADMIN",
  "MARKETING_ADMIN",
  "MODERATOR",
] as const;

// Permission types for each module
export type Permission =
  | "dashboard.view"
  | "users.view"
  | "users.edit"
  | "users.ban"
  | "users.delete"
  | "users.adjust_balance"
  | "kyc.view"
  | "kyc.approve"
  | "kyc.reject"
  | "tasks.view"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.delete"
  | "submissions.view"
  | "submissions.approve"
  | "submissions.reject"
  | "withdrawals.view"
  | "withdrawals.process"
  | "withdrawals.approve"
  | "withdrawals.reject"
  | "marketplace.view"
  | "marketplace.manage"
  | "marketplace.disputes"
  | "packages.view"
  | "packages.edit"
  | "referrals.view"
  | "referrals.configure"
  | "proxy.view"
  | "proxy.manage"
  | "notifications.view"
  | "notifications.send"
  | "analytics.view"
  | "analytics.export"
  | "settings.view"
  | "settings.edit"
  | "admins.view"
  | "admins.manage"
  | "logs.view";

// Permission matrix based on ADMIN_DASHBOARD_SPECS.md
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [], // No admin permissions

  SUPER_ADMIN: [
    // Full access to everything
    "dashboard.view",
    "users.view", "users.edit", "users.ban", "users.delete", "users.adjust_balance",
    "kyc.view", "kyc.approve", "kyc.reject",
    "tasks.view", "tasks.create", "tasks.edit", "tasks.delete",
    "submissions.view", "submissions.approve", "submissions.reject",
    "withdrawals.view", "withdrawals.process", "withdrawals.approve", "withdrawals.reject",
    "marketplace.view", "marketplace.manage", "marketplace.disputes",
    "packages.view", "packages.edit",
    "referrals.view", "referrals.configure",
    "proxy.view", "proxy.manage",
    "notifications.view", "notifications.send",
    "analytics.view", "analytics.export",
    "settings.view", "settings.edit",
    "admins.view", "admins.manage",
    "logs.view",
  ],

  FINANCE_ADMIN: [
    "dashboard.view",
    "users.view",
    "withdrawals.view", "withdrawals.process", "withdrawals.approve", "withdrawals.reject",
    "marketplace.view",
    "packages.view", "packages.edit",
    "analytics.view", "analytics.export",
  ],

  CONTENT_ADMIN: [
    "dashboard.view",
    "users.view",
    "tasks.view", "tasks.create", "tasks.edit",
    "submissions.view", "submissions.approve", "submissions.reject",
    "notifications.view", "notifications.send",
    "analytics.view",
  ],

  SUPPORT_ADMIN: [
    "dashboard.view",
    "users.view", "users.edit", "users.ban",
    "kyc.view", "kyc.approve", "kyc.reject",
    "tasks.view",
    "marketplace.view", "marketplace.disputes",
  ],

  MARKETING_ADMIN: [
    "dashboard.view",
    "users.view",
    "notifications.view", "notifications.send",
    "analytics.view", "analytics.export",
    "referrals.view",
  ],

  MODERATOR: [
    "dashboard.view",
    "tasks.view",
    "submissions.view", "submissions.approve", "submissions.reject",
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: UserRole | undefined, permissions: Permission[]): boolean {
  if (!role) return false;
  return permissions.every((p) => hasPermission(role, p));
}

// Check if a user is an admin
export function isAdmin(role: UserRole | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role);
}

// Check if a user is a super admin
export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === "SUPER_ADMIN";
}

// Admin navigation modules with their required permissions
export interface AdminModule {
  name: string;
  href: string;
  icon: string;
  permissions: Permission[];
  badge?: string;
}

export const ADMIN_MODULES: AdminModule[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: "LayoutDashboard",
    permissions: ["dashboard.view"],
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: "Users",
    permissions: ["users.view"],
  },
  {
    name: "Tasks",
    href: "/admin/tasks",
    icon: "ListTodo",
    permissions: ["tasks.view"],
  },
  {
    name: "Submissions",
    href: "/admin/submissions",
    icon: "ClipboardCheck",
    permissions: ["submissions.view"],
  },
  {
    name: "Withdrawals",
    href: "/admin/withdrawals",
    icon: "Wallet",
    permissions: ["withdrawals.view"],
  },
  {
    name: "Marketplace",
    href: "/admin/marketplace",
    icon: "Store",
    permissions: ["marketplace.view"],
  },
  {
    name: "Media Library",
    href: "/admin/media",
    icon: "ImageIcon",
    permissions: ["tasks.create"], // Only SUPER_ADMIN and admins with content creation access
  },
  {
    name: "Lottery",
    href: "/admin/lottery",
    icon: "Ticket",
    permissions: ["settings.view"],
  },
  {
    name: "Packages",
    href: "/admin/packages",
    icon: "Package",
    permissions: ["packages.view"],
  },
  {
    name: "Referrals",
    href: "/admin/referrals",
    icon: "GitBranch",
    permissions: ["referrals.view"],
  },
  {
    name: "Proxy Servers",
    href: "/admin/proxy",
    icon: "Globe",
    permissions: ["proxy.view"],
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    icon: "Bell",
    permissions: ["notifications.view"],
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: "BarChart3",
    permissions: ["analytics.view"],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: "Settings",
    permissions: ["settings.view"],
  },
  {
    name: "Admin Access",
    href: "/admin/access",
    icon: "Shield",
    permissions: ["admins.view"],
  },
];

// Get modules accessible by a role
export function getAccessibleModules(role: UserRole | undefined): AdminModule[] {
  if (!role) return [];
  return ADMIN_MODULES.filter((module) =>
    module.permissions.some((p) => hasPermission(role, p))
  );
}

// Role display names and colors
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  USER: { label: "User", color: "text-gray-400", bgColor: "bg-gray-500/10" },
  SUPER_ADMIN: { label: "Super Admin", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  FINANCE_ADMIN: { label: "Finance Admin", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  CONTENT_ADMIN: { label: "Content Admin", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  SUPPORT_ADMIN: { label: "Support Admin", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  MARKETING_ADMIN: { label: "Marketing Admin", color: "text-pink-400", bgColor: "bg-pink-500/10" },
  MODERATOR: { label: "Moderator", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
};
