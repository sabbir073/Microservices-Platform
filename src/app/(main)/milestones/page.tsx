import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MilestonesView } from "@/components/user/gamification/milestones-view";

export default async function MilestonesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <MilestonesView />;
}
