import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocationType, type LocationType } from "@/lib/locations";

// GET /api/locations/children
//
// Query params (one of two modes):
//   • parentId=<id>           → returns children of that location
//   • countryId=<id>&type=<T> → returns top-level locations of that type for a country
// Optional:
//   • q=<search>              → name contains, case-insensitive
//   • limit=<N>               → default 200, max 1000
const getChildrenForParent = unstable_cache(
  async (parentId: string, q: string | null, limit: number) => {
    return prisma.location.findMany({
      where: {
        parentId,
        isActive: true,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, name: true, type: true, postalCode: true },
      orderBy: { name: "asc" },
      take: limit,
    });
  },
  ["locations:children:by-parent"],
  { revalidate: 600, tags: ["locations:children"] }
);

const getTopLevel = unstable_cache(
  async (countryId: string, type: LocationType, q: string | null, limit: number) => {
    return prisma.location.findMany({
      where: {
        countryId,
        type,
        parentId: null,
        isActive: true,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, name: true, type: true, postalCode: true },
      orderBy: { name: "asc" },
      take: limit,
    });
  },
  ["locations:children:top-level"],
  { revalidate: 600, tags: ["locations:children"] }
);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get("parentId");
  const countryId = searchParams.get("countryId");
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const limitRaw = parseInt(searchParams.get("limit") ?? "200", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(1000, limitRaw))
    : 200;
  const search = q && q.trim().length > 0 ? q.trim() : null;

  if (parentId) {
    const items = await getChildrenForParent(parentId, search, limit);
    return NextResponse.json({ items });
  }

  if (countryId && type) {
    if (!isLocationType(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    const items = await getTopLevel(countryId, type, search, limit);
    return NextResponse.json({ items });
  }

  return NextResponse.json(
    { error: "Provide either parentId, or countryId + type" },
    { status: 400 }
  );
}
