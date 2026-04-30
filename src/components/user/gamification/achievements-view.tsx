"use client";

import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  emoji?: string;
  unlocked: boolean;
  unlockedAt?: string;
  pointsReward?: number;
  criteria?: string;
}

export function AchievementsView() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Badge | null>(null);

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => (r.ok ? r.json() : { badges: [] }))
      .then((d) => setBadges(d.badges ?? []))
      .catch(() => setBadges([]))
      .finally(() => setLoading(false));
  }, []);

  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-white">🏅 Achievements</h1>
      <p className="text-sm text-gray-400">
        Unlocked: <strong className="text-white">{unlocked}</strong> /{" "}
        {badges.length}
      </p>

      {loading && <ListSkeleton rows={3} />}

      {!loading && (
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <button
              key={b.id}
              onClick={() => setActive(b)}
              className={cn(
                "relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-2 transition-colors",
                b.unlocked
                  ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5"
                  : "border-gray-800 bg-gray-900 opacity-60"
              )}
            >
              <div className="text-3xl">
                {b.unlocked
                  ? b.emoji ?? "🏆"
                  : <Lock className="w-6 h-6 text-gray-600" />}
              </div>
              <p
                className={cn(
                  "text-[10px] font-bold text-center line-clamp-2",
                  b.unlocked ? "text-white" : "text-gray-500"
                )}
              >
                {b.name}
              </p>
              {b.unlocked && (
                <span className="absolute top-1 right-1 text-[10px] text-emerald-400">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-sm w-full text-center"
          >
            <div className="text-6xl mb-3">
              {active.unlocked ? active.emoji ?? "🏆" : "🔒"}
            </div>
            <h2 className="text-xl font-bold text-white">{active.name}</h2>
            {active.description && (
              <p className="text-sm text-gray-400 mt-1 mb-4">
                {active.description}
              </p>
            )}
            {active.criteria && (
              <p className="text-xs text-gray-500 mt-2 mb-2">
                <strong>How to unlock:</strong> {active.criteria}
              </p>
            )}
            {active.pointsReward && (
              <p className="text-sm text-amber-400 font-bold">
                Reward: +{active.pointsReward} pts
              </p>
            )}
            {active.unlockedAt && (
              <p className="text-[11px] text-emerald-400 mt-2">
                Unlocked on {new Date(active.unlockedAt).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={() => setActive(null)}
              className="mt-4 w-full py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
