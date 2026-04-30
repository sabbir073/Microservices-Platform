import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuizTasksView } from "@/components/user/tasks/quiz-tasks-view";

export default async function QuizTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <QuizTasksView />;
}
