import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bell, CheckCircle, Gift, Wallet, Users, Settings } from "lucide-react";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-gray-400 mt-1">Stay updated with your activity</p>
        </div>
        <button className="text-sm text-indigo-400 hover:text-indigo-300">
          Mark all as read
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["All", "Earnings", "Tasks", "Referrals", "System"].map((filter, i) => (
          <button
            key={filter}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i === 0 ? "bg-indigo-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No notifications</p>
          <p className="text-sm mt-2">You&apos;re all caught up!</p>
        </div>
      </div>
    </div>
  );
}
