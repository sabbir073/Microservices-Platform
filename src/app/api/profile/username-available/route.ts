import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidUsername } from "@/lib/username";

// GET /api/profile/username-available?u=<handle>
// Lightweight live check for the profile username field. Returns whether the
// handle is free (case-insensitive), ignoring the caller's own current handle.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = (req.nextUrl.searchParams.get("u") ?? "").trim().replace(/^@+/, "");
  if (!raw) {
    return NextResponse.json({ available: false, reason: "empty" });
  }
  if (!isValidUsername(raw)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const taken = await prisma.user.findFirst({
    where: {
      username: { equals: raw, mode: "insensitive" },
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  return NextResponse.json({ available: !taken });
}
