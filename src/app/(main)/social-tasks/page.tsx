import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SocialTasksView } from "@/components/user/tasks/social-tasks-view";

export default async function SocialTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <SocialTasksView />;
}
