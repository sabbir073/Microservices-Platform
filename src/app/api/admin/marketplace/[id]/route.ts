import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "marketplace.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        purchases: {
          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ listing });
  } catch (error) {
    console.error("Error fetching listing:", error);
    return NextResponse.json(
      { error: "Failed to fetch listing" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "marketplace.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    // Check if listing exists
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id },
      include: { seller: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (action === "cancel") {
      // Cancel the listing
      const updatedListing = await prisma.marketplaceListing.update({
        where: { id },
        data: {
          status: "CANCELLED",
        },
      });

      // Create a notification for the seller
      await prisma.notification.create({
        data: {
          userId: listing.sellerId,
          type: "SYSTEM",
          title: "Listing Cancelled",
          message: `Your listing "${listing.title}" has been cancelled by an administrator. Reason: ${reason}`,
          data: {
            listingId: id,
            reason,
            cancelledBy: session.user.id,
          },
        },
      });

      return NextResponse.json({
        success: true,
        listing: updatedListing,
        message: "Listing cancelled successfully",
      });
    } else if (action === "activate") {
      // Reactivate a cancelled or expired listing
      if (listing.status === "SOLD") {
        return NextResponse.json(
          { error: "Cannot reactivate a sold listing" },
          { status: 400 }
        );
      }

      const updatedListing = await prisma.marketplaceListing.update({
        where: { id },
        data: {
          status: "ACTIVE",
        },
      });

      return NextResponse.json({
        success: true,
        listing: updatedListing,
        message: "Listing reactivated successfully",
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 }
    );
  }
}
