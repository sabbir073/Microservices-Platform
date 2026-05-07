import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArticleTaskDetailView } from "@/components/user/tasks/article-task-detail-view";

export default async function ArticleTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  return <ArticleTaskDetailView taskId={id} />;
}
