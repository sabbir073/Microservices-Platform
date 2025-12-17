import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Star,
  Trophy,
  Coins,
  CheckCircle,
  Camera,
} from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

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
                  {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 transition-colors">
                  <Camera className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Name & Email */}
              <h2 className="text-xl font-bold text-white mt-4">
                {user.name || "User"}
              </h2>
              <p className="text-gray-500 text-sm">{user.email}</p>

              {/* Level Badge */}
              <div className="mt-4 px-4 py-2 bg-indigo-500/10 rounded-full">
                <span className="text-indigo-400 text-sm font-medium">
                  Level 1 • 0 XP
                </span>
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">0</p>
                  <p className="text-xs text-gray-500">Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">0</p>
                  <p className="text-xs text-gray-500">Referrals</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">0</p>
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
                <span className="flex items-center gap-1 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-400">Phone</span>
                </div>
                <button className="text-indigo-400 text-sm hover:text-indigo-300">
                  Verify
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-400">KYC</span>
                </div>
                <button className="text-indigo-400 text-sm hover:text-indigo-300">
                  Submit
                </button>
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
              <button className="text-sm text-indigo-400 hover:text-indigo-300">
                Edit
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  Full Name
                </label>
                <p className="text-white">{user.name || "Not set"}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  Email
                </label>
                <p className="text-white">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  Phone
                </label>
                <p className="text-white">Not set</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1.5">
                  Country
                </label>
                <p className="text-white">Not set</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-500 mb-1.5">
                  Bio
                </label>
                <p className="text-white">No bio added yet</p>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-white mb-6">Achievements</h3>
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No achievements yet</p>
                <p className="text-sm mt-1">
                  Complete tasks to earn achievements!
                </p>
              </div>
            </div>
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
    </div>
  );
}
