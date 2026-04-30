import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatWindow } from "@/components/user/chat/chat-window";

export default async function ChatWindowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <ChatWindow conversationId={id} currentUserId={session.user.id} />;
}
