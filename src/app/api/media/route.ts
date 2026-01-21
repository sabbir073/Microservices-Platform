import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

// GET /api/media - Get all media items with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "tasks.view")) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const fileType = searchParams.get("fileType");
    const search = searchParams.get("search");
    const uploadedBy = searchParams.get("uploadedBy");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Record<string, unknown> = {};

    if (fileType && fileType !== "all") {
      where.fileType = fileType;
    }

    if (search) {
      where.OR = [
        { originalFilename: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } },
        { caption: { contains: search, mode: "insensitive" } },
      ];
    }

    if (uploadedBy) {
      where.uploadedById = uploadedBy;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.media.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      hasMore: page * limit < total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}
