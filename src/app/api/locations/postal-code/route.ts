import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/locations/postal-code?locationId=<id>
//
// Returns the postal code attached to a location row (any level — admin can
// attach codes at city, sub-district, or district level depending on the
// country). Used by the LocationSelector to auto-fill the postal-code input
// when the user selects the deepest dropdown.
//
// If the requested location has no postalCode but its parent chain does,
// we walk up to the closest ancestor with one.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("locationId");
  if (!id) {
    return NextResponse.json({ error: "locationId required" }, { status: 400 });
  }

  let cursor = await prisma.location.findUnique({
    where: { id },
    select: { id: true, parentId: true, postalCode: true, isActive: true },
  });
  if (!cursor || !cursor.isActive) {
    return NextResponse.json({ postalCode: null });
  }

  // Walk up to 6 levels max (matches the deepest BD hierarchy).
  for (let depth = 0; depth < 6; depth++) {
    if (cursor.postalCode) {
      return NextResponse.json({ postalCode: cursor.postalCode });
    }
    if (!cursor.parentId) break;
    cursor = await prisma.location.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true, postalCode: true, isActive: true },
    });
    if (!cursor || !cursor.isActive) break;
  }
  return NextResponse.json({ postalCode: null });
}
