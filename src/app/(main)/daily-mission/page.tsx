import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DailyMissionView } from "@/components/user/missions/daily-mission-view";

export default async function DailyMissionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <DailyMissionView />;
}
