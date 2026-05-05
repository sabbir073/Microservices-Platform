import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SurveyTasksView } from "@/components/user/tasks/survey-tasks-view";

export default async function SurveyTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <SurveyTasksView />;
}
