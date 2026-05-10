import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomTaskDetailView } from "@/components/user/tasks/custom-task-detail-view";

export default async function CustomTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  return <CustomTaskDetailView taskId={id} />;
}
