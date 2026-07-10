import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuizRunner } from "@/components/user/quizzes/quiz-runner";

export default async function QuizRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  return <QuizRunner quizId={id} />;
}
