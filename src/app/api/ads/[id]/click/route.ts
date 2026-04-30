import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.ad
    .update({
      where: { id },
      data: { clicks: { increment: 1 } },
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
