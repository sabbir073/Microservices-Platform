import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveFeatures } from "@/lib/packages";
import { FeatureLock } from "@/components/user/primitives/feature-lock";
import { GamesCatalog } from "@/components/user/games/games-catalog";

export default async function GamesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enabled } = await getEffectiveFeatures(session.user.id);
  if (!enabled.has("games")) return <FeatureLock title="HTML5 Games" />;

  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      iconUrl: true,
      embedUrl: true,
      playsCount: true,
    },
  });

  return <GamesCatalog games={games} />;
}
