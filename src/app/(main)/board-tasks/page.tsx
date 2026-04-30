import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BoardTasksView } from "@/components/user/tasks/board-tasks-view";

export default async function BoardTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <BoardTasksView />;
}
