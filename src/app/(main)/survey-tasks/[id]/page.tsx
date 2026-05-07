import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SurveyTaskDetailView } from "@/components/user/tasks/survey-task-detail-view";

export default async function SurveyTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  return <SurveyTaskDetailView taskId={id} />;
}
