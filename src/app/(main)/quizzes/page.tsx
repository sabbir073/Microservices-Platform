import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { QuizzesView } from "@/components/user/quizzes/quizzes-view";

export default async function QuizzesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <QuizzesView />;
}
