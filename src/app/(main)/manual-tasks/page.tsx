import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ManualTasksView } from "@/components/user/tasks/manual-tasks-view";

export default async function ManualTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ManualTasksView />;
}
