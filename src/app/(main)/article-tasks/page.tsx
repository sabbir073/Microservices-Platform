import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArticleTasksView } from "@/components/user/tasks/article-tasks-view";

export default async function ArticleTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <ArticleTasksView />;
}
