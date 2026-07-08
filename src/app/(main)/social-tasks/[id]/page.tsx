import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SocialTaskRunView } from "@/components/user/tasks/social-task-run-view";

export default async function SocialTaskRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  return <SocialTaskRunView taskId={id} />;
}
