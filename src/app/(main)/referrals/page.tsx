import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users,
  Copy,
  Share2,
  Gift,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";

export default async function ReferralsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Generate referral link (in production, this would come from the database)
  const referralCode = "EARN" + session.user.id.slice(0, 6).toUpperCase();
  const referralLink = `https://earngpt.com/register?ref=${referralCode}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Referrals</h1>
        <p className="text-gray-400 mt-1">
          Invite friends and earn commissions on their earnings
        </p>
      </div>

      {/* Referral Link Card */}
      <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Gift className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Your Referral Link
            </h2>
            <p className="text-sm text-gray-400">
              Share this link to earn commissions
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            />
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:opacity-90 transition-opacity">
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-indigo-300">
          <CheckCircle className="w-4 h-4" />
          Earn 10% commission on every referral&apos;s earnings!
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-sm text-gray-400">Total Referrals</span>
          </div>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-gray-400">Active Referrals</span>
          </div>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-sm text-gray-400">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-white">$0.00</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">This Month</span>
          </div>
          <p className="text-2xl font-bold text-white">$0.00</p>
        </div>
      </div>

      {/* Commission Levels */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-6">
          Commission Structure
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-indigo-400">
                Level 1
              </span>
              <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-medium rounded-full">
                Direct
              </span>
            </div>
            <p className="text-2xl font-bold text-white">10%</p>
            <p className="text-sm text-gray-500 mt-1">
              Commission on direct referrals
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-400">
                Level 2
              </span>
              <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-full">
                Indirect
              </span>
            </div>
            <p className="text-2xl font-bold text-white">5%</p>
            <p className="text-sm text-gray-500 mt-1">
              Commission on 2nd level
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-pink-400">Level 3</span>
              <span className="px-2 py-1 bg-pink-500/10 text-pink-400 text-xs font-medium rounded-full">
                Indirect
              </span>
            </div>
            <p className="text-2xl font-bold text-white">2%</p>
            <p className="text-sm text-gray-500 mt-1">
              Commission on 3rd level
            </p>
          </div>
        </div>
      </div>

      {/* Referral List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Your Referrals</h2>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="all">All Levels</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
          </select>
        </div>

        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No referrals yet</p>
            <p className="text-sm mt-1">Share your link to start earning!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
