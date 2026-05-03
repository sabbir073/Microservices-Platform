import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TasksHubView } from "@/components/user/tasks/tasks-hub-view";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <TasksHubView />;
}
