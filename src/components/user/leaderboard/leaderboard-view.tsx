"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Medal, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface Row {
  rank: number;
  userId: string;
  name: string | null;
  avatar: string | null;
  level: number;
  packageTier: string;
  value: number;
}

interface CurrentUser {
  rank: number | string;
  value: number;
  isInTop: boolean;
}

const METRICS = [
  { key: "points", label: "Points", suffix: "pts" },
  { key: "xp", label: "XP", suffix: "XP" },
  { key: "tasks", label: "Tasks", suffix: "" },
  { key: "referrals", label: "Referrals", suffix: "" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export function LeaderboardView({ currentUserId }: { currentUserId: string }) {
  const [metric, setMetric] = useState<MetricKey>("points");
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // `silent` skips the loading state so background auto-refreshes don't flash.
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await fetch(`/api/leaderboard?type=${metric}&limit=50`, {
          cache: "no-store",
        });
        const d = r.ok ? await r.json() : { leaderboard: [], currentUser: null };
        setRows(d.leaderboard ?? []);
        setMe(d.currentUser ?? null);
      } catch {
        if (!silent) {
          setRows([]);
          setMe(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [metric]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh: tab refocus + 15s timer (paused while tab hidden).
  useAutoRefresh(() => load(true));

  const suffix = METRICS.find((m) => m.key === metric)!.suffix;
  const fmt = (v: number) => `${v.toLocaleString()}${suffix ? ` ${suffix}` : ""}`;

  // Podium order: 2nd, 1st, 3rd
  const podium = [rows[1], rows[0], rows[2]];
  const podiumMeta = [
    { color: "from-gray-400 to-gray-500", icon: Medal, rank: 2 },
    { color: "from-amber-400 to-yellow-500", icon: Crown, rank: 1 },
    { color: "from-amber-600 to-orange-700", icon: Medal, rank: 3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-gray-400 mt-1">See where you rank against other earners</p>
      </div>

      {/* Metric filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              if (m.key !== metric) {
                setLoading(true);
                setMetric(m.key);
              }
            }}
            className={cn(
              "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              metric === m.key
                ? "bg-indigo-500 text-white"
                : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 py-16 text-center text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No rankings yet</p>
          <p className="text-sm mt-1">Complete tasks to appear on the leaderboard!</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          <div className="grid grid-cols-3 gap-4">
            {podium.map((row, i) =>
              row ? (
                <div
                  key={row.userId}
                  className={cn(
                    "bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-6 text-center",
                    i === 1 ? "-mt-4" : "mt-4"
                  )}
                >
                  <div
                    className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-linear-to-br flex items-center justify-center mb-3",
                      podiumMeta[i].color
                    )}
                  >
                    {(() => {
                      const Icon = podiumMeta[i].icon;
                      return <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />;
                    })()}
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-white">
                    #{podiumMeta[i].rank}
                  </p>
                  <p className="text-sm text-white truncate mt-1">{row.name}</p>
                  <p className="text-indigo-400 font-medium mt-1 text-sm">
                    {fmt(row.value)}
                  </p>
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "bg-gray-900/50 rounded-xl border border-gray-800/60 p-4 sm:p-6 text-center",
                    i === 1 ? "-mt-4" : "mt-4"
                  )}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-3">
                    <Medal className="w-7 h-7 text-gray-600" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-600">
                    #{podiumMeta[i].rank}
                  </p>
                  <p className="text-gray-500 mt-1 text-sm">No one yet</p>
                </div>
              )
            )}
          </div>

          {/* Current user (if outside top) */}
          {me && !me.isInTop && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-indigo-300 font-medium">
                Your rank: <span className="font-bold">#{me.rank}</span>
              </span>
              <span className="text-sm text-white font-semibold tabular-nums">
                {fmt(me.value)}
              </span>
            </div>
          )}

          {/* Full table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Rank</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Level</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-400">
                      {METRICS.find((m) => m.key === metric)!.label}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.userId}
                      className={cn(
                        "border-b border-gray-800/60 last:border-0",
                        row.userId === currentUserId && "bg-indigo-500/10"
                      )}
                    >
                      <td className="py-3 px-4 text-sm font-bold text-gray-300 tabular-nums">
                        #{row.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
                            {row.name?.charAt(0)?.toUpperCase() ?? "U"}
                          </div>
                          <span className="text-sm text-white truncate">
                            {row.name}
                            {row.userId === currentUserId && (
                              <span className="ml-1 text-[10px] text-indigo-400">(You)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400 tabular-nums">
                        Lv {row.level}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-white tabular-nums">
                        {fmt(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
