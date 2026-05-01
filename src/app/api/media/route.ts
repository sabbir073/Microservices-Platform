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
    const folder = searchParams.get("folder"); // "" = root, null = all folders
    const includeFolders = searchParams.get("includeFolders") === "true";

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

    if (folder !== null) {
      where.folder = folder;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [items, total, folderRows] = await Promise.all([
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
      includeFolders
        ? prisma.media.findMany({
            distinct: ["folder"],
            select: { folder: true },
            orderBy: { folder: "asc" },
          })
        : Promise.resolve([] as Array<{ folder: string }>),
    ]);

    const folders = includeFolders
      ? folderRows.map((r) => r.folder).filter((f) => typeof f === "string")
      : undefined;

    return NextResponse.json({
      items,
      total,
      hasMore: page * limit < total,
      page,
      limit,
      ...(folders ? { folders } : {}),
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}
