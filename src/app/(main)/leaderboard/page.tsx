import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeaderboardView } from "@/components/user/leaderboard/leaderboard-view";
import { AdRenderer } from "@/components/user/primitives/ad-renderer";
import { isLeaderboardEnabled } from "@/lib/leaderboard-gate";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // `lb_enabled` off means OFF, not hidden. The nav entry disappears via
  // getHiddenPaths, but a bookmark reaches this file directly — so it is
  // checked here as well, and in /api/leaderboard for a saved request.
  if (!(await isLeaderboardEnabled())) redirect("/dashboard");

  return (
    <>
      <AdRenderer placement="LEADERBOARD_TOP" className="mb-4" />
      <LeaderboardView currentUserId={session.user.id} />
    </>
  );
}
