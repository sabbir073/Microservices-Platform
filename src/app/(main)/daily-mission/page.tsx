import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DailyMissionView } from "@/components/user/missions/daily-mission-view";
import { ProfileGate } from "@/components/user/profile/profile-gate";
import { getProfileGateState } from "@/lib/profile-gate-server";

export default async function DailyMissionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const gate = await getProfileGateState(session.user.id);
  if (gate.locked) {
    return <ProfileGate progress={gate.progress} surface="the Daily Mission" />;
  }

  return <DailyMissionView />;
}
