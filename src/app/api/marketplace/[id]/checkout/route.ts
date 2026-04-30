import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  const listing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Listing is not active" },
      { status: 400 }
    );
  }
  if (listing.sellerId === userId) {
    return NextResponse.json(
      { error: "Cannot purchase your own listing" },
      { status: 400 }
    );
  }

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { cashBalance: true },
  });
  if (!buyer) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (buyer.cashBalance < listing.price) {
    return NextResponse.json(
      {
        error: "Insufficient cash balance",
        details: `Need $${listing.price.toFixed(2)}, have $${buyer.cashBalance.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  const fee = listing.price * 0.05; // 5% platform fee
  const sellerAmount = listing.price - fee;

  // Create purchase, debit buyer, credit seller (in transaction)
  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.marketplacePurchase.create({
      data: {
        listingId: id,
        buyerId: userId,
        amount: listing.price,
        fee,
        sellerAmount,
        status: "COMPLETED",
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { cashBalance: { decrement: listing.price } },
    });
    await tx.user.update({
      where: { id: listing.sellerId },
      data: {
        cashBalance: { increment: sellerAmount },
        totalEarnings: { increment: sellerAmount },
      },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "PURCHASE",
        status: "COMPLETED",
        amount: listing.price,
        description: `Purchased: ${listing.title}`,
        reference: p.id,
      },
    });
    await tx.transaction.create({
      data: {
        userId: listing.sellerId,
        type: "EARNING",
        status: "COMPLETED",
        amount: sellerAmount,
        description: `Sold: ${listing.title} (after 5% fee)`,
        reference: p.id,
      },
    });
    return p;
  });

  return NextResponse.json({
    success: true,
    purchaseId: purchase.id,
    checkoutUrl: null, // direct purchase from cash balance, no redirect needed
  });
}
