import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const userId = session.user.id;

  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conv.user1Id !== userId && conv.user2Id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isUser1 = conv.user1Id === userId;

  await prisma.$transaction([
    prisma.chatMessage.updateMany({
      where: {
        conversationId: id,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true, readAt: new Date() },
    }),
    prisma.conversation.update({
      where: { id },
      data: isUser1 ? { unreadByUser1: 0 } : { unreadByUser2: 0 },
    }),
  ]);

  return NextResponse.json({ success: true });
}
