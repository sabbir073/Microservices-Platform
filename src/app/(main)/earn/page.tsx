import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Gift, Clock, Coins, Star, CheckCircle } from "lucide-react";

export default async function EarnPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Earn</h1>
        <p className="text-gray-400 mt-1">Multiple ways to earn rewards</p>
      </div>

      {/* Daily Check-in */}
      <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Gift className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Daily Check-in</h2>
              <p className="text-gray-400">Check in daily to earn bonus points</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
            Check In
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2 mt-6">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div key={day} className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-500">Day {day}</p>
              <p className="text-lg font-bold text-white mt-1">{day * 10}</p>
              <p className="text-xs text-gray-500">pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earning Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Watch Videos", desc: "Earn by watching short videos", icon: Star, points: "5-20 pts" },
          { title: "Complete Surveys", desc: "Share your opinions", icon: CheckCircle, points: "50-200 pts" },
          { title: "Download Apps", desc: "Try new applications", icon: Gift, points: "100-500 pts" },
        ].map((item, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors">
            <div className="p-3 bg-indigo-500/10 rounded-xl w-fit mb-4">
              <item.icon className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-white">{item.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
            <p className="text-indigo-400 font-medium mt-3">{item.points}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>More earning options coming soon!</p>
        </div>
      </div>
    </div>
  );
}
