import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatInbox } from "@/components/user/chat/chat-inbox";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <ChatInbox userId={session.user.id} />;
}
