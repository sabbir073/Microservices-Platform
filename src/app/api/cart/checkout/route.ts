import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { listing: true },
  });
  type WithListing = (typeof items)[number] & {
    listing: {
      id: string;
      sellerId: string;
      price: number;
      status: string;
      title: string;
    };
  };
  const cart = items as WithListing[];

  if (cart.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Validate each item is purchaseable
  const inactive = cart.filter(
    (i) => i.listing.status !== "ACTIVE" || i.listing.sellerId === userId
  );
  if (inactive.length > 0) {
    return NextResponse.json(
      {
        error: `${inactive.length} item${inactive.length > 1 ? "s are" : " is"} no longer available. Remove and retry.`,
      },
      { status: 400 }
    );
  }

  const total = cart.reduce((s, i) => s + i.listing.price * i.quantity, 0);

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { cashBalance: true },
  });
  if (!buyer) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (buyer.cashBalance < total) {
    return NextResponse.json(
      {
        error: "Insufficient cash balance",
        details: `Need $${total.toFixed(2)}, have $${buyer.cashBalance.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  const purchases = await prisma.$transaction(async (tx) => {
    const created: { id: string; listingId: string; quantity: number }[] = [];

    for (const item of cart) {
      for (let q = 0; q < item.quantity; q++) {
        const fee = item.listing.price * 0.05;
        const sellerAmount = item.listing.price - fee;
        const p = await tx.marketplacePurchase.create({
          data: {
            listingId: item.listing.id,
            buyerId: userId,
            amount: item.listing.price,
            fee,
            sellerAmount,
            status: "COMPLETED",
          },
        });
        await tx.user.update({
          where: { id: item.listing.sellerId },
          data: {
            cashBalance: { increment: sellerAmount },
            totalEarnings: { increment: sellerAmount },
          },
        });
        await tx.transaction.create({
          data: {
            userId: item.listing.sellerId,
            type: "EARNING",
            status: "COMPLETED",
            amount: sellerAmount,
            description: `Sold: ${item.listing.title} (after 5% fee)`,
            reference: p.id,
          },
        });
        created.push({ id: p.id, listingId: item.listing.id, quantity: 1 });
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { cashBalance: { decrement: total } },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "PURCHASE",
        status: "COMPLETED",
        amount: total,
        description: `Cart checkout (${cart.length} listing${cart.length > 1 ? "s" : ""})`,
        reference: `cart_${Date.now()}_${userId}`,
      },
    });
    await tx.cartItem.deleteMany({ where: { userId } });

    return created;
  });

  return NextResponse.json({
    success: true,
    purchases,
    total,
  });
}
