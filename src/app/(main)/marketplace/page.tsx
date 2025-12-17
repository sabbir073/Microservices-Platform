import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Store, Search, Filter } from "lucide-react";

export default async function MarketplacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        <p className="text-gray-400 mt-1">Buy and sell digital products</p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="search"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button className="p-2.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Digital Products", "Services", "Templates", "Guides"].map((cat, i) => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              i === 0 ? "bg-indigo-500 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="text-center">
          <Store className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Marketplace coming soon!</p>
          <p className="text-sm mt-2">You&apos;ll be able to buy and sell digital products here.</p>
        </div>
      </div>
    </div>
  );
}
