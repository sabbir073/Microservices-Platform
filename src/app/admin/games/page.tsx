import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Gamepad2 } from "lucide-react";
import { GamesClient } from "@/components/admin/games/games-client";

export default async function GamesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "games.view")) redirect("/admin");

  const canManage = hasPermission(adminRole, "games.manage");
  const games = await prisma.game.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-emerald-400" />
          HTML5 Games
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Add embeddable games. Users play them full-screen with interstitial ads.
        </p>
      </div>
      <GamesClient
        initial={games.map((g) => ({
          id: g.id,
          title: g.title,
          category: g.category,
          description: g.description,
          iconUrl: g.iconUrl,
          embedUrl: g.embedUrl,
          order: g.order,
          isActive: g.isActive,
          playsCount: g.playsCount,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
