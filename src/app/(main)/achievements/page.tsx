import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AchievementsView } from "@/components/user/gamification/achievements-view";

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <AchievementsView />;
}
