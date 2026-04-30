import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListingDetailView } from "@/components/user/marketplace/listing-detail-view";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          avatar: true,
          username: true,
        },
      },
    },
  });
  if (!listing) notFound();

  return (
    <ListingDetailView
      listing={{
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        price: listing.price,
        currency: listing.currency,
        images: listing.images,
        status: listing.status,
        views: listing.views,
        createdAt: listing.createdAt.toISOString(),
        seller: {
          id: listing.seller.id,
          name: listing.seller.name,
          avatar: listing.seller.avatar,
          username: listing.seller.username,
        },
      }}
      isOwner={listing.sellerId === session.user.id}
    />
  );
}
