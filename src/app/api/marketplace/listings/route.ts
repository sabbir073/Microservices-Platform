import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketplaceListingStatus } from "@/generated/prisma";

// GET /api/marketplace/listings - Get marketplace listings
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const sellerId = searchParams.get("sellerId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build query
    const where: Record<string, unknown> = {
      status: MarketplaceListingStatus.ACTIVE,
    };

    if (sellerId) {
      where.sellerId = sellerId;
      // If viewing own listings, show all statuses
      if (session?.user?.id === sellerId) {
        delete where.status;
      }
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        (where.price as Record<string, number>).gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        (where.price as Record<string, number>).lte = parseFloat(maxPrice);
      }
    }

    // Build orderBy
    const orderBy: Record<string, string> = {};
    if (sortBy === "price") {
      orderBy.price = sortOrder;
    } else if (sortBy === "views") {
      orderBy.views = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get listings
    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              avatar: true,
              level: true,
            },
          },
          _count: {
            select: { purchases: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    // Format listings
    const formattedListings = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description?.substring(0, 200),
      images: listing.images,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      status: listing.status,
      views: listing.views,
      salesCount: listing._count.purchases,
      createdAt: listing.createdAt,
      seller: listing.seller,
      isOwner: session?.user?.id === listing.sellerId,
    }));

    // Get unique categories
    const allListings = await prisma.marketplaceListing.findMany({
      where: { status: MarketplaceListingStatus.ACTIVE },
      select: { category: true },
    });

    const categoryCount = allListings.reduce((acc: Record<string, number>, l) => {
      acc[l.category] = (acc[l.category] || 0) + 1;
      return acc;
    }, {});

    const categoryList = Object.entries(categoryCount).map(([name, count]) => ({
      name,
      count,
    }));

    return NextResponse.json({
      listings: formattedListings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      categories: categoryList,
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

// POST /api/marketplace/listings - Create a new listing
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, category, images, files, price } = body;

    // Validate required fields
    if (!title || !description || !category || !price) {
      return NextResponse.json(
        { error: "Title, description, category, and price are required" },
        { status: 400 }
      );
    }

    if (price < 1) {
      return NextResponse.json(
        { error: "Price must be at least $1" },
        { status: 400 }
      );
    }

    // Create listing
    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: session.user.id,
        title,
        description,
        category,
        images: images || [],
        files: files || [],
        price,
        currency: "USD",
        status: MarketplaceListingStatus.ACTIVE,
      },
    });

    return NextResponse.json({
      listing: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        createdAt: listing.createdAt,
      },
      message: "Listing created successfully",
    });
  } catch (error) {
    console.error("Error creating listing:", error);
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    );
  }
}
