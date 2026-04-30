import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VideoTasksView } from "@/components/user/tasks/video-tasks-view";

export default async function VideoTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <VideoTasksView />;
}
