"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Star,
  Trophy,
  CheckCircle,
  Camera,
  X,
  Loader2,
  Globe,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ProfileData {
  profile: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    phone: string | null;
    country: string | null;
    language: string;
    timezone: string;
    createdAt: string;
  };
  stats: {
    level: number;
    xp: number;
    xpProgress: number;
    xpNeeded: number;
    xpPercentage: number;
    pointsBalance: number;
    cashBalance: number;
    totalEarnings: number;
    tasksCompleted: number;
    referralsCount: number;
    achievementsCount: number;
  };
  verification: {
    kycStatus: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isFullyVerified: boolean;
  };
  referral: {
    code: string;
    link: string;
  };
}

const countries = [
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "US", name: "United States" },
  { code: "UK", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
];

const languages = [
  { code: "en", name: "English" },
  { code: "bn", name: "Bengali" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    country: "",
    language: "en",
    timezone: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setProfileData(data);
          // Initialize edit form with current values
          setEditForm({
            name: data.profile.name || "",
            phone: data.profile.phone || "",
            country: data.profile.country || "",
            language: data.profile.language || "en",
            timezone: data.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update local state
      setProfileData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            name: editForm.name,
            phone: editForm.phone,
            country: editForm.country,
            language: editForm.language,
            timezone: editForm.timezone,
          },
        };
      });

      setIsEditModalOpen(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session?.user || !profileData) {
    return null;
  }

  const { profile, stats, verification, referral } = profileData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-gray-400 mt-1">Manage your personal information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                  {profile.name?.charAt(0) || profile.email?.charAt(0) || "U"}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 transition-colors">
                  <Camera className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Name & Email */}
              <h2 className="text-xl font-bold text-white mt-4">
                {profile.name || "User"}
              </h2>
              <p className="text-gray-500 text-sm">{profile.email}</p>

              {/* Level Badge */}
              <div className="mt-4 px-4 py-2 bg-indigo-500/10 rounded-full">
                <span className="text-indigo-400 text-sm font-medium">
                  Level {stats.level} • {stats.xp.toLocaleString()} XP
                </span>
              </div>

              {/* XP Progress */}
              <div className="w-full mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress to Level {stats.level + 1}</span>
                  <span>{stats.xpPercentage}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${stats.xpPercentage}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{stats.tasksCompleted}</p>
                  <p className="text-xs text-gray-500">Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{stats.referralsCount}</p>
                  <p className="text-xs text-gray-500">Referrals</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{stats.achievementsCount}</p>
                  <p className="text-xs text-gray-500">Badges</p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mt-6">
            <h3 className="font-semibold text-white mb-4">Verification</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-400">Email</span>
                </div>
                {verification.isEmailVerified ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                ) : (
                  <button className="text-indigo-400 text-sm hover:text-indigo-300">
                    Verify
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-400">Phone</span>
                </div>
                {verification.isPhoneVerified ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                ) : (
                  <button className="text-indigo-400 text-sm hover:text-indigo-300">
                    Verify
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-400">KYC</span>
                </div>
                {verification.kycStatus === "APPROVED" ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Verified
                  </span>
                ) : verification.kycStatus === "PENDING" ? (
                  <span className="text-yellow-400 text-sm">Pending</span>
                ) : (
                  <button className="text-indigo-400 text-sm hover:text-indigo-300">
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Referral Code */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mt-6">
            <h3 className="font-semibold text-white mb-4">Referral</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">Your Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referral.code}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(referral.code);
                      toast.success("Referral code copied!");
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">Share Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referral.link}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(referral.link);
                      toast.success("Referral link copied!");
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white">Personal Information</h3>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <User className="w-4 h-4 inline mr-1" /> Full Name
                </label>
                <p className="text-white">{profile.name || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <Mail className="w-4 h-4 inline mr-1" /> Email
                </label>
                <p className="text-white">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <Phone className="w-4 h-4 inline mr-1" /> Phone
                </label>
                <p className="text-white">{profile.phone || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <MapPin className="w-4 h-4 inline mr-1" /> Country
                </label>
                <p className="text-white">
                  {countries.find((c) => c.code === profile.country)?.name || profile.country || "Not set"}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <Globe className="w-4 h-4 inline mr-1" /> Language
                </label>
                <p className="text-white">
                  {languages.find((l) => l.code === profile.language)?.name || profile.language}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  <Clock className="w-4 h-4 inline mr-1" /> Timezone
                </label>
                <p className="text-white">{profile.timezone}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-500 mb-1.5">
                  <Calendar className="w-4 h-4 inline mr-1" /> Member Since
                </label>
                <p className="text-white">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Earnings Overview */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white mb-6">Earnings Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-2xl font-bold text-white">{stats.pointsBalance.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Points Balance</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-2xl font-bold text-emerald-400">${stats.cashBalance.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Cash Balance</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-2xl font-bold text-white">{stats.totalEarnings.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Earned</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-2xl font-bold text-white">{stats.tasksCompleted}</p>
                <p className="text-xs text-gray-500">Tasks Done</p>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white mb-6">Achievements</h3>
            {stats.achievementsCount > 0 ? (
              <p className="text-gray-400">You have {stats.achievementsCount} achievements</p>
            ) : (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <div className="text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No achievements yet</p>
                  <p className="text-sm mt-1">Complete tasks to earn achievements!</p>
                </div>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white mb-6">Badges</h3>
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="text-center">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No badges earned</p>
                <p className="text-sm mt-1">Keep earning to unlock badges!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="+880 1234 567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Country
                </label>
                <select
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={editForm.language}
                  onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Timezone
                </label>
                <input
                  type="text"
                  value={editForm.timezone}
                  onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Asia/Dhaka"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-800">
              <Button
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                isLoading={isSaving}
                className="flex-1"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
