import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Trophy, Medal, Crown, Users } from "lucide-react";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-gray-400 mt-1">Top earners this week</p>
      </div>

      {/* Time Filter */}
      <div className="flex gap-2">
        {["This Week", "This Month", "All Time"].map((period, i) => (
          <button
            key={period}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i === 0 ? "bg-indigo-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { rank: 2, color: "from-gray-400 to-gray-500", icon: Medal },
          { rank: 1, color: "from-amber-400 to-yellow-500", icon: Crown },
          { rank: 3, color: "from-amber-600 to-orange-700", icon: Medal },
        ].map((item, i) => (
          <div key={i} className={`bg-gray-900 rounded-xl border border-gray-800 p-6 text-center ${i === 1 ? "-mt-4" : "mt-4"}`}>
            <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
              <item.icon className="w-8 h-8 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">#{item.rank}</p>
            <p className="text-gray-500 mt-1">No one yet</p>
            <p className="text-indigo-400 font-medium mt-2">0 pts</p>
          </div>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Rank</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">User</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Points</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Tasks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-16 text-center text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No rankings yet</p>
                  <p className="text-sm mt-1">Complete tasks to appear on the leaderboard!</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
