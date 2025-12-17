import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Settings,
  Globe,
  DollarSign,
  Shield,
  Mail,
  Bell,
  Palette,
  Database,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { hasPermission, type UserRole } from "@/lib/rbac";

const SETTING_CATEGORIES = [
  {
    key: "general",
    label: "General Settings",
    description: "Site name, logo, and basic configuration",
    icon: Settings,
    color: "text-gray-400",
  },
  {
    key: "earning",
    label: "Earning Settings",
    description: "Points conversion, withdrawal limits, and fees",
    icon: DollarSign,
    color: "text-emerald-400",
  },
  {
    key: "security",
    label: "Security Settings",
    description: "KYC requirements, anti-fraud measures",
    icon: Shield,
    color: "text-red-400",
  },
  {
    key: "email",
    label: "Email Settings",
    description: "SMTP configuration and email templates",
    icon: Mail,
    color: "text-blue-400",
  },
  {
    key: "notifications",
    label: "Notification Settings",
    description: "Push notification and alert settings",
    icon: Bell,
    color: "text-purple-400",
  },
  {
    key: "appearance",
    label: "Appearance Settings",
    description: "Theme, colors, and UI customization",
    icon: Palette,
    color: "text-pink-400",
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Third-party services and API keys",
    icon: Zap,
    color: "text-amber-400",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    description: "System maintenance and data management",
    icon: Database,
    color: "text-cyan-400",
  },
];

export default async function AdminSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "settings.view")) {
    redirect("/admin");
  }

  // Fetch settings grouped by category
  const settings = await prisma.systemSetting.findMany({
    orderBy: { category: "asc" },
  });

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, typeof settings>);

  const canEdit = hasPermission(adminRole, "settings.edit");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-gray-400 mt-1">
          Configure application settings and preferences
        </p>
      </div>

      {/* Settings Categories */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTING_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const categorySettings = settingsByCategory[category.key] || [];

          return (
            <Link
              key={category.key}
              href={`/admin/settings/${category.key}`}
              className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-gray-800 ${category.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {category.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {categorySettings.length} setting{categorySettings.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Settings</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Maintenance Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Temporarily disable access for users</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  className="sr-only peer"
                  id="maintenance-mode"
                />
                <label
                  htmlFor="maintenance-mode"
                  className="block w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-red-500 cursor-pointer transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
                >
                  <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">New Registrations</p>
                <p className="text-xs text-gray-500 mt-0.5">Allow new user sign-ups</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  defaultChecked
                  className="sr-only peer"
                  id="registrations"
                />
                <label
                  htmlFor="registrations"
                  className="block w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-emerald-500 cursor-pointer transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
                >
                  <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">Withdrawals Enabled</p>
                <p className="text-xs text-gray-500 mt-0.5">Allow users to request withdrawals</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  defaultChecked
                  className="sr-only peer"
                  id="withdrawals"
                />
                <label
                  htmlFor="withdrawals"
                  className="block w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-emerald-500 cursor-pointer transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
                >
                  <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></span>
                </label>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">KYC Required</p>
                <p className="text-xs text-gray-500 mt-0.5">Require KYC for withdrawals</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  defaultChecked
                  className="sr-only peer"
                  id="kyc-required"
                />
                <label
                  htmlFor="kyc-required"
                  className="block w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-emerald-500 cursor-pointer transition-colors peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
                >
                  <span className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">System Information</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Version</p>
            <p className="text-white font-mono">1.0.0</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Environment</p>
            <p className="text-white font-mono">{process.env.NODE_ENV || "development"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Database</p>
            <p className="text-white font-mono">PostgreSQL + Prisma Accelerate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
