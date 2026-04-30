import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListingCard } from "@/components/user/primitives/listing-card";
import { EmptyState } from "@/components/user/primitives/empty-state";
import { Package } from "lucide-react";

export default async function MyListingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const listings = await prisma.marketplaceListing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white flex-1">My Listings</h1>
        <Link
          href="/marketplace/create"
          className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold"
        >
          + New
        </Link>
      </div>
      {listings.length === 0 && (
        <EmptyState
          icon={Package}
          title="No listings yet"
          description="Create your first listing to start selling."
          action={{ label: "Create Listing", href: "/marketplace/create" }}
        />
      )}
      {listings.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              href={`/marketplace/${l.id}`}
              image={l.images[0]}
              title={l.title}
              price={l.price}
              unit="USD"
              category={l.category}
              badge={l.status === "SOLD" ? "SOLD" : l.status === "CANCELLED" ? "CANCELLED" : l.status === "EXPIRED" ? "EXPIRED" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
