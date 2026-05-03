import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatInbox } from "@/components/user/chat/chat-inbox";

interface PageProps {
  searchParams: Promise<{ with?: string }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { with: withUserId } = await searchParams;

  // ?with=USER_ID — find or create conversation, then redirect to it
  if (withUserId && withUserId !== userId) {
    const otherUser = await prisma.user.findUnique({
      where: { id: withUserId },
      select: { id: true },
    });
    if (otherUser) {
      const [user1Id, user2Id] = [userId, otherUser.id].sort();
      const conversation = await prisma.conversation.upsert({
        where: { user1Id_user2Id: { user1Id, user2Id } },
        create: { user1Id, user2Id },
        update: {},
      });
      redirect(`/chat/${conversation.id}`);
    }
  }

  return <ChatInbox userId={userId} />;
}
