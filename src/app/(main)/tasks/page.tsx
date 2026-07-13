import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TasksHubView } from "@/components/user/tasks/tasks-hub-view";
import { ProfileGate } from "@/components/user/profile/profile-gate";
import { getProfileGateState } from "@/lib/profile-gate-server";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const gate = await getProfileGateState(session.user.id);
  if (gate.locked) {
    return <ProfileGate progress={gate.progress} surface="Tasks" />;
  }

  return <TasksHubView />;
}
