import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Moon,
  Smartphone,
  Mail,
  Key,
  Trash2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// Settings Section Component
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// Settings Item Component
function SettingsItem({
  icon: Icon,
  title,
  description,
  action,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="font-medium text-white">{title}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
      {action || (href && <ChevronRight className="w-5 h-5 text-gray-500" />)}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-gray-800/50 -mx-2 px-2 rounded-lg transition-colors">
        {content}
      </Link>
    );
  }

  return content;
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <nav className="space-y-1">
              {[
                { icon: User, label: "Account", href: "#account" },
                { icon: Bell, label: "Notifications", href: "#notifications" },
                { icon: Shield, label: "Security", href: "#security" },
                { icon: CreditCard, label: "Payment", href: "#payment" },
                { icon: Globe, label: "Preferences", href: "#preferences" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Settings */}
          <SettingsSection
            title="Account"
            description="Manage your account information"
          >
            <div className="space-y-0">
              <SettingsItem
                icon={User}
                title="Edit Profile"
                description="Update your name, bio, and avatar"
                href="/profile"
              />
              <SettingsItem
                icon={Mail}
                title="Email Address"
                description={session.user.email || "Not set"}
                action={
                  <span className="text-sm text-emerald-400">Verified</span>
                }
              />
              <SettingsItem
                icon={Smartphone}
                title="Phone Number"
                description="Not verified"
                action={
                  <button className="text-sm text-indigo-400 hover:text-indigo-300">
                    Add
                  </button>
                }
              />
            </div>
          </SettingsSection>

          {/* Notification Settings */}
          <SettingsSection
            title="Notifications"
            description="Configure how you receive notifications"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Push Notifications</p>
                  <p className="text-sm text-gray-500">
                    Receive notifications on your device
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Email Notifications</p>
                  <p className="text-sm text-gray-500">
                    Receive updates via email
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Task Reminders</p>
                  <p className="text-sm text-gray-500">
                    Get reminded about available tasks
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
            </div>
          </SettingsSection>

          {/* Security Settings */}
          <SettingsSection
            title="Security"
            description="Keep your account secure"
          >
            <div className="space-y-0">
              <SettingsItem
                icon={Key}
                title="Change Password"
                description="Update your password regularly"
                action={
                  <button className="text-sm text-indigo-400 hover:text-indigo-300">
                    Change
                  </button>
                }
              />
              <SettingsItem
                icon={Shield}
                title="Two-Factor Authentication"
                description="Add an extra layer of security"
                action={
                  <button className="text-sm text-indigo-400 hover:text-indigo-300">
                    Enable
                  </button>
                }
              />
            </div>
          </SettingsSection>

          {/* Preferences */}
          <SettingsSection
            title="Preferences"
            description="Customize your experience"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <Moon className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Dark Mode</p>
                    <p className="text-sm text-gray-500">
                      Use dark theme
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <Globe className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Language</p>
                    <p className="text-sm text-gray-500">
                      Select your preferred language
                    </p>
                  </div>
                </div>
                <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                  <option value="en">English</option>
                  <option value="bn">বাংলা</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          {/* Danger Zone */}
          <SettingsSection title="Danger Zone">
            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div>
                <p className="font-medium text-red-400">Delete Account</p>
                <p className="text-sm text-gray-500">
                  Permanently delete your account and all data
                </p>
              </div>
              <button className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
