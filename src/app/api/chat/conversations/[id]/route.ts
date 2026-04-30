import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

  const otherId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
  const otherUser = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, avatar: true },
  });

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({
    otherUser: otherUser
      ? {
          id: otherUser.id,
          name: otherUser.name,
          avatar: otherUser.avatar,
          isOnline: false,
        }
      : null,
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      createdAt: m.createdAt.toISOString(),
      read: m.read,
    })),
  });
}
