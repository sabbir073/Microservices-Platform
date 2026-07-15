import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/games/[id]/play — increment the play counter (fire-and-forget).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.game
    .update({ where: { id }, data: { playsCount: { increment: 1 } } })
    .catch(() => {});
  return NextResponse.json({ success: true });
}
