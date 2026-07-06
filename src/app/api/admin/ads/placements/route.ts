import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { ensureDefaultPlacements } from "@/lib/ad-placements-server";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Make sure the canonical slots always exist.
  await ensureDefaultPlacements().catch(() => {});
  const placements = await prisma.adPlacement.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { ads: true } } },
  });
  return NextResponse.json({ placements });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!session?.user || !hasPermission(role, "ads.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const placement = await prisma.adPlacement.upsert({
    where: { name },
    create: { name, platform: body.platform || "ALL", isActive: true },
    update: {},
  });
  return NextResponse.json({ placement });
}
