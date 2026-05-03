import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/users/search?q=al&limit=5
// Used by @mention autocomplete in the social composer/comments.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") || "5", 10)));

  if (q.length < 1) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { username: { startsWith: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: [{ followersCount: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      isBlueVerified: true,
    },
  });

  return NextResponse.json({ users });
}
