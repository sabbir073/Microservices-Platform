import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProxyTasksView } from "@/components/user/tasks/proxy-tasks-view";

export default async function ProxyTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ProxyTasksView />;
}
