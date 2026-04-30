import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SocialPostsView } from "@/components/user/tasks/social-posts-view";

export default async function SocialPostsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <SocialPostsView />;
}
