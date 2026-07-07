import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OfferwallsView } from "@/components/user/offerwalls/offerwalls-view";

export const dynamic = "force-dynamic";

export default async function OfferwallsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const configs = await prisma.offerwallConfig.findMany({
    where: { isActive: true },
    orderBy: { provider: "asc" },
  });

  const walls = configs
    .map((c) => {
      const cfg =
        c.config && typeof c.config === "object" && !Array.isArray(c.config)
          ? (c.config as { iframeUrl?: string })
          : {};
      const raw = (cfg.iframeUrl ?? "").trim();
      if (!raw) return null;
      const url = raw.replace(/\{userId\}/g, encodeURIComponent(session.user!.id!));
      return { provider: c.provider, url };
    })
    .filter((w): w is { provider: string; url: string } => w !== null);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-6 h-6 text-emerald-400" />
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white">Offerwalls</h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Complete offers from our partners to earn extra points.
          </p>
        </div>
      </div>

      {walls.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-400">
          No offerwalls are available right now. Check back soon.
        </div>
      ) : (
        <OfferwallsView walls={walls} />
      )}
    </div>
  );
}
