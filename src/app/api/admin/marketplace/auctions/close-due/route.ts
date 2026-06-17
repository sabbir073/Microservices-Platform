import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import {
  MarketplaceBidStatus,
  MarketplaceListingStatus,
  NotificationType,
  TransactionType,
  TransactionStatus,
} from "@/generated/prisma";
import {
  resolveCommissionBps,
  splitPrice,
} from "@/lib/marketplace-commission";

// POST /api/admin/marketplace/auctions/close-due
//
// Cron-friendly: finds every auction-mode listing whose `auctionEndsAt`
// passed and is still ACTIVE, then settles each one (winner picked if reserve
// met, otherwise listing → EXPIRED).
//
// Auth: admin (`marketplace.manage`) — for production schedule via a cron job
// hitting this endpoint with an admin session, or wrap in a server action.
// Returns a summary of what changed.
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role as UserRole | undefined;
    if (!hasPermission(role, "marketplace.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const due = await prisma.marketplaceListing.findMany({
      where: {
        auctionMode: true,
        status: MarketplaceListingStatus.ACTIVE,
        auctionEndsAt: { lte: now },
      },
      select: {
        id: true,
        sellerId: true,
        title: true,
        assetType: true,
        reservePrice: true,
        commissionRateBps: true,
      },
      take: 50, // batch size — call again to drain a backlog
    });

    type Result =
      | { listingId: string; outcome: "sold"; winnerId: string; amount: number }
      | { listingId: string; outcome: "expired"; reason: string };
    const results: Result[] = [];

    for (const listing of due) {
      const highBid = await prisma.marketplaceBid.findFirst({
        where: {
          listingId: listing.id,
          status: MarketplaceBidStatus.ACTIVE,
        },
        orderBy: { amount: "desc" },
      });

      // No bids at all → expire
      if (!highBid) {
        await prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: { status: MarketplaceListingStatus.EXPIRED },
        });
        await prisma.notification.create({
          data: {
            userId: listing.sellerId,
            type: NotificationType.SYSTEM,
            title: "Auction expired — no bids",
            message: `Your auction "${listing.title}" ended without any bids.`,
            data: { listingId: listing.id },
          },
        });
        results.push({
          listingId: listing.id,
          outcome: "expired",
          reason: "No bids",
        });
        continue;
      }

      // Reserve not met → expire
      if (
        listing.reservePrice != null &&
        highBid.amount < listing.reservePrice
      ) {
        await prisma.$transaction([
          prisma.marketplaceListing.update({
            where: { id: listing.id },
            data: { status: MarketplaceListingStatus.EXPIRED },
          }),
          prisma.marketplaceBid.updateMany({
            where: {
              listingId: listing.id,
              status: {
                in: [MarketplaceBidStatus.ACTIVE, MarketplaceBidStatus.OUTBID],
              },
            },
            data: { status: MarketplaceBidStatus.LOST },
          }),
        ]);
        await prisma.notification.create({
          data: {
            userId: listing.sellerId,
            type: NotificationType.SYSTEM,
            title: "Auction closed — reserve not met",
            message: `Your auction "${listing.title}" closed below reserve. Highest bid: $${highBid.amount.toLocaleString()}.`,
            data: { listingId: listing.id },
          },
        });
        results.push({
          listingId: listing.id,
          outcome: "expired",
          reason: "Reserve not met",
        });
        continue;
      }

      // Pick winner — same settlement path as the manual close endpoint
      const amount = highBid.amount;
      const bps = await resolveCommissionBps({
        assetType: listing.assetType,
        perListingOverride: listing.commissionRateBps,
      });
      const { fee, sellerAmount } = splitPrice(amount, bps);

      const [purchase] = await prisma.$transaction([
        prisma.marketplacePurchase.create({
          data: {
            listingId: listing.id,
            buyerId: highBid.bidderId,
            amount,
            fee,
            sellerAmount,
            status: "COMPLETED",
          },
        }),
        prisma.marketplaceBid.update({
          where: { id: highBid.id },
          data: { status: MarketplaceBidStatus.WON },
        }),
        prisma.marketplaceBid.updateMany({
          where: {
            listingId: listing.id,
            id: { not: highBid.id },
            status: {
              in: [MarketplaceBidStatus.ACTIVE, MarketplaceBidStatus.OUTBID],
            },
          },
          data: { status: MarketplaceBidStatus.LOST },
        }),
        prisma.marketplaceListing.update({
          where: { id: listing.id },
          data: { status: MarketplaceListingStatus.SOLD },
        }),
        prisma.user.update({
          where: { id: highBid.bidderId },
          data: { cashBalance: { decrement: amount } },
        }),
        prisma.user.update({
          where: { id: listing.sellerId },
          data: {
            cashBalance: { increment: sellerAmount },
            totalEarnings: { increment: sellerAmount },
          },
        }),
        prisma.transaction.create({
          data: {
            userId: highBid.bidderId,
            type: TransactionType.PURCHASE,
            status: TransactionStatus.COMPLETED,
            amount: -amount,
            points: 0,
            description: `Auction won — "${listing.title}"`,
            reference: `marketplace_auction_${listing.id}`,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: listing.sellerId,
            type: TransactionType.EARNING,
            status: TransactionStatus.COMPLETED,
            amount: sellerAmount,
            points: 0,
            description: `Auction sale — "${listing.title}"`,
            reference: `marketplace_auction_${listing.id}`,
          },
        }),
      ]);

      await Promise.all([
        prisma.notification.create({
          data: {
            userId: highBid.bidderId,
            type: NotificationType.SYSTEM,
            title: "You won the auction! 🎉",
            message: `You won "${listing.title}" with a $${amount.toLocaleString()} bid.`,
            data: { listingId: listing.id, amount, purchaseId: purchase.id },
          },
        }),
        prisma.notification.create({
          data: {
            userId: listing.sellerId,
            type: NotificationType.SYSTEM,
            title: "Auction closed — sold",
            message: `Your auction "${listing.title}" sold for $${amount.toLocaleString()}.`,
            data: { listingId: listing.id, amount, purchaseId: purchase.id },
          },
        }),
      ]);

      results.push({
        listingId: listing.id,
        outcome: "sold",
        winnerId: highBid.bidderId,
        amount,
      });
    }

    return NextResponse.json({
      processed: due.length,
      results,
      hasMore: due.length === 50,
    });
  } catch (error) {
    console.error("Auto-close auctions failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
