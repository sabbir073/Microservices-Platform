"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  X,
  AlertCircle,
  Loader2,
  Users,
  User,
  Search,
  Crown,
  CheckCircle,
  Bell,
  Megaphone,
  Gift,
  Wallet,
  Trophy,
  Ticket,
  MessageSquare,
} from "lucide-react";

const NOTIFICATION_TYPES = [
  { value: "SYSTEM", label: "System", icon: AlertCircle, color: "text-gray-400" },
  { value: "TASK", label: "Task", icon: CheckCircle, color: "text-blue-400" },
  { value: "WALLET", label: "Wallet", icon: Wallet, color: "text-emerald-400" },
  { value: "REFERRAL", label: "Referral", icon: Users, color: "text-purple-400" },
  { value: "PROMOTION", label: "Promotion", icon: Megaphone, color: "text-amber-400" },
  { value: "ACHIEVEMENT", label: "Achievement", icon: Trophy, color: "text-yellow-400" },
  { value: "LOTTERY", label: "Lottery", icon: Ticket, color: "text-pink-400" },
  { value: "SOCIAL", label: "Social", icon: MessageSquare, color: "text-indigo-400" },
];

const TARGET_OPTIONS = [
  { value: "all", label: "All Users", description: "Send to every registered user" },
  { value: "package", label: "By Package", description: "Filter by subscription tier" },
  { value: "specific", label: "Specific Users", description: "Select individual users" },
];

const PACKAGE_TIERS = ["FREE", "BASIC", "STANDARD", "PREMIUM"];

interface SearchedUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  packageTier: string;
}

export function SendNotificationForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    type: "SYSTEM",
    title: "",
    message: "",
    target: "all",
    packageFilter: [] as string[],
    userIds: [] as string[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch {
      console.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.title.trim()) {
      setError("Title is required");
      setLoading(false);
      return;
    }

    if (!formData.message.trim()) {
      setError("Message is required");
      setLoading(false);
      return;
    }

    if (formData.target === "package" && formData.packageFilter.length === 0) {
      setError("Please select at least one package tier");
      setLoading(false);
      return;
    }

    if (formData.target === "specific" && selectedUsers.length === 0) {
      setError("Please select at least one user");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        type: formData.type,
        title: formData.title,
        message: formData.message,
        target: formData.target,
        packageFilter: formData.target === "package" ? formData.packageFilter : undefined,
        userIds: formData.target === "specific" ? selectedUsers.map((u) => u.id) : undefined,
      };

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      setSuccess(`Successfully sent notification to ${data.recipientCount} user(s)`);
      setTimeout(() => {
        router.push("/admin/notifications");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const togglePackage = (pkg: string) => {
    setFormData((prev) => ({
      ...prev,
      packageFilter: prev.packageFilter.includes(pkg)
        ? prev.packageFilter.filter((p) => p !== pkg)
        : [...prev.packageFilter, pkg],
    }));
  };

  const addUser = (user: SearchedUser) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-emerald-400">{success}</p>
        </div>
      )}

      {/* Notification Type */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Notification Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NOTIFICATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, type: type.value })}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  formData.type === type.value
                    ? "bg-indigo-500/10 border-indigo-500"
                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                }`}
              >
                <Icon className={`w-5 h-5 ${type.color} mb-2`} />
                <p className="text-sm font-medium text-white">{type.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white mb-4">Content</h2>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter notification title..."
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Enter notification message..."
            rows={4}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      </div>

      {/* Target Audience */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white mb-4">Target Audience</h2>

        <div className="grid md:grid-cols-3 gap-4">
          {TARGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData({ ...formData, target: option.value })}
              className={`p-4 rounded-lg border text-left transition-colors ${
                formData.target === option.value
                  ? "bg-indigo-500/10 border-indigo-500"
                  : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
              }`}
            >
              {option.value === "all" && <Users className="w-5 h-5 text-indigo-400 mb-2" />}
              {option.value === "package" && <Crown className="w-5 h-5 text-purple-400 mb-2" />}
              {option.value === "specific" && <User className="w-5 h-5 text-emerald-400 mb-2" />}
              <p className="font-medium text-white">{option.label}</p>
              <p className="text-xs text-gray-500 mt-1">{option.description}</p>
            </button>
          ))}
        </div>

        {/* Package Filter */}
        {formData.target === "package" && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
            <p className="text-sm font-medium text-gray-400 mb-3">Select Package Tiers</p>
            <div className="flex flex-wrap gap-2">
              {PACKAGE_TIERS.map((pkg) => (
                <button
                  key={pkg}
                  type="button"
                  onClick={() => togglePackage(pkg)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.packageFilter.includes(pkg)
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  {pkg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User Search */}
        {formData.target === "specific" && (
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Search users by name or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700 max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => addUser(user)}
                    disabled={selectedUsers.some((u) => u.id === user.id)}
                    className="w-full p-3 text-left hover:bg-gray-700/50 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {user.name?.charAt(0) || user.email.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
                      {user.packageTier}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-sm font-medium text-gray-400 mb-3">
                  Selected Users ({selectedUsers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg"
                    >
                      <span className="text-sm text-white">{user.name || user.email}</span>
                      <button
                        type="button"
                        onClick={() => removeUser(user.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      {formData.title && formData.message && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Preview</h2>
          <div className="p-4 bg-gray-800/50 rounded-lg flex items-start gap-3">
            <div className="p-2 bg-gray-700 rounded-lg">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-white">{formData.title}</p>
              <p className="text-sm text-gray-400 mt-1">{formData.message}</p>
              <p className="text-xs text-gray-600 mt-2">Just now</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.push("/admin/notifications")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading || !formData.title || !formData.message}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          Send Notification
        </button>
      </div>
    </form>
  );
}
