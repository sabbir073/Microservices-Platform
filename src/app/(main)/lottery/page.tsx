import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Ticket, Gift, Clock, Trophy } from "lucide-react";

export default async function LotteryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Lottery</h1>
        <p className="text-gray-400 mt-1">Try your luck and win big!</p>
      </div>

      {/* Current Lottery */}
      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Ticket className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Weekly Jackpot</h2>
            <p className="text-gray-400">Draw every Sunday at 8 PM</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900/50 rounded-lg text-center">
            <p className="text-sm text-gray-400">Prize Pool</p>
            <p className="text-2xl font-bold text-white mt-1">0 PTS</p>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg text-center">
            <p className="text-sm text-gray-400">Tickets Sold</p>
            <p className="text-2xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-4 bg-gray-900/50 rounded-lg text-center">
            <p className="text-sm text-gray-400">Time Left</p>
            <p className="text-2xl font-bold text-white mt-1">--:--:--</p>
          </div>
        </div>

        <button className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
          Buy Ticket (100 PTS)
        </button>
      </div>

      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active lotteries</p>
          <p className="text-sm mt-1">Check back soon!</p>
        </div>
      </div>
    </div>
  );
}
