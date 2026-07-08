import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/user/leaderboard/leaderboard-view";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <LeaderboardView currentUserId={session.user.id} />;
}
