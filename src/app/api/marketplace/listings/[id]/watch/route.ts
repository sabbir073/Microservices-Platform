import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/marketplace/listings/:id/watch — add to watchlist
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      select: { id: true, sellerId: true },
    });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (listing.sellerId === session.user.id) {
      return NextResponse.json(
        { error: "You can't watch your own listing" },
        { status: 400 }
      );
    }

    await prisma.marketplaceWatch.upsert({
      where: { userId_listingId: { userId: session.user.id, listingId: id } },
      create: { userId: session.user.id, listingId: id },
      update: {},
    });

    const watchCount = await prisma.marketplaceWatch.count({
      where: { listingId: id },
    });
    return NextResponse.json({ isWatched: true, watchCount });
  } catch (error) {
    console.error("Watch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/marketplace/listings/:id/watch — remove from watchlist
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    await prisma.marketplaceWatch.deleteMany({
      where: { userId: session.user.id, listingId: id },
    });

    const watchCount = await prisma.marketplaceWatch.count({
      where: { listingId: id },
    });
    return NextResponse.json({ isWatched: false, watchCount });
  } catch (error) {
    console.error("Unwatch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
