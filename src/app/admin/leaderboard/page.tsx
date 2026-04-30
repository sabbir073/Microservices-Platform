import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Trophy } from "lucide-react";
import { LeaderboardSettingsForm } from "@/components/admin/leaderboard/leaderboard-settings-form";

export default async function LeaderboardManagementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "leaderboards.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "leaderboards.manage");

  const rows = await prisma.systemSetting.findMany({
    where: { category: "leaderboard" },
  });
  const initial: Record<string, unknown> = {};
  for (const r of rows) initial[r.key.replace("lb_", "")] = r.value;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          Leaderboard Management
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure prize pools, reset cadence, and metric used for rankings.
        </p>
      </div>
      <LeaderboardSettingsForm initial={initial} canEdit={canManage} />
    </div>
  );
}
