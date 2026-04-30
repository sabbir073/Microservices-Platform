"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, Plus, ShoppingBag, Package, ListChecks } from "lucide-react";
import { ListingCard } from "@/components/user/primitives/listing-card";
import { FilterChips } from "@/components/user/primitives/filter-chips";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { EmptyState } from "@/components/user/primitives/empty-state";

interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  views: number;
  createdAt: string;
  seller: { name: string | null; avatar: string | null };
}

const CATEGORIES = [
  "ALL",
  "DIGITAL_PRODUCT",
  "SERVICE",
  "TEMPLATE",
  "GUIDE",
  "COURSE",
  "OTHER",
];

const CAT_LABEL: Record<string, string> = {
  ALL: "All",
  DIGITAL_PRODUCT: "Digital",
  SERVICE: "Services",
  TEMPLATE: "Templates",
  GUIDE: "Guides",
  COURSE: "Courses",
  OTHER: "Other",
};

export function MarketplaceView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (search) params.set("q", search);
    fetch(`/api/marketplace?${params}`)
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => !cancelled && setListings(d.listings ?? []))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white flex-1">🛒 Marketplace</h1>
        <Link
          href="/marketplace/my"
          className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
          aria-label="My listings"
        >
          <Package className="w-4 h-4" />
        </Link>
        <Link
          href="/marketplace/orders"
          className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
          aria-label="Orders"
        >
          <ListChecks className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search marketplace..."
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <Link
          href="/marketplace/create"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Sell
        </Link>
      </div>

      <FilterChips
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: CAT_LABEL[c] ?? c }))}
      />

      {loading && (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListSkeleton key={i} rows={1} />
          ))}
        </div>
      )}

      {!loading && listings.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="No listings found"
          description={
            search
              ? `Nothing matches "${search}"`
              : "Be the first to list a product."
          }
          action={{ label: "Create Listing", href: "/marketplace/create" }}
        />
      )}

      {!loading && listings.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              href={`/marketplace/${l.id}`}
              image={l.images[0]}
              title={l.title}
              sellerName={l.seller.name ?? "Anonymous"}
              sellerAvatar={l.seller.avatar ?? undefined}
              price={l.price}
              unit="USD"
              category={CAT_LABEL[l.category] ?? l.category}
            />
          ))}
        </div>
      )}
    </div>
  );
}
