"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, Trophy, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  initial: Record<string, unknown>;
  canEdit: boolean;
}

type Period = "daily" | "weekly" | "monthly";

interface CycleWinner {
  rank: number;
  userId: string;
  name: string;
  value: number;
  prize: number;
}

interface Cycle {
  cycleId: string;
  period: Period;
  metric: string;
  totalPrize: number;
  cycledAt: string;
  winners: CycleWinner[];
}

const DEFAULTS = {
  enabled: true,
  metric: "POINTS_EARNED" as
    | "POINTS_EARNED"
    | "TASKS_COMPLETED"
    | "REFERRALS"
    | "XP_EARNED",
  daily_prize: 5000,
  weekly_prize: 25000,
  monthly_prize: 100000,
  daily_winners: 1,
  weekly_winners: 3,
  monthly_winners: 5,
  daily_distribution: [5000] as number[],
  weekly_distribution: [12500, 7500, 5000] as number[],
  monthly_distribution: [50000, 25000, 15000, 6000, 4000] as number[],
  min_entries: 5,
  auto_reset: true,
};

type Values = typeof DEFAULTS;

export function LeaderboardSettingsForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...DEFAULTS, ...(initial as Partial<Values>) });
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState<Period | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const set = <K extends keyof Values>(k: K, val: Values[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/leaderboard/history");
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setCycles(d.cycles ?? []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const settings: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) settings[`lb_${k}`] = val;
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "leaderboard", settings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("Leaderboard settings saved");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const triggerReset = async (period: Period) => {
    if (
      !window.confirm(
        `Reset ${period} leaderboard now? This selects winners and credits prizes.`
      )
    )
      return;
    setResetting(period);
    try {
      const res = await fetch("/api/admin/leaderboard/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(
        `${period[0].toUpperCase() + period.slice(1)} leaderboard reset complete`,
        {
          description: `${data.awarded} winner${data.awarded === 1 ? "" : "s"} · ${data.totalDistributed} pts distributed`,
        }
      );
      await loadHistory();
      router.refresh();
    } catch (err) {
      toast.error(`${period} reset failed`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setResetting(null);
    }
  };

  const distributionField = (
    period: Period,
    winnerCount: number,
    distribution: number[]
  ) => {
    const key = `${period}_distribution` as keyof Values;
    const updated = (next: number[]) => set(key, next as never);
    const sized = [...distribution];
    while (sized.length < winnerCount) sized.push(0);
    sized.length = winnerCount;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">
          Per-rank distribution ({winnerCount} rank{winnerCount === 1 ? "" : "s"}):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sized.map((amt, i) => (
            <div key={i} className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-400">
                #{i + 1}
              </span>
              <input
                type="number"
                min={0}
                value={amt}
                onChange={(e) => {
                  const copy = [...sized];
                  copy[i] = parseInt(e.target.value) || 0;
                  updated(copy);
                }}
                disabled={!canEdit}
                className="w-full pl-8 pr-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 tabular-nums">
          Sum: {sized.reduce((a, b) => a + b, 0).toLocaleString()} pts (target pool:{" "}
          {Number(v[`${period}_prize` as keyof Values] ?? 0).toLocaleString()} pts)
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!v.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            disabled={!canEdit}
            className="rounded bg-slate-800 border-slate-600 text-emerald-500"
          />
          <span className="text-white font-medium">Leaderboard enabled</span>
        </label>

        <Field label="Ranking Metric">
          <select
            value={v.metric as string}
            onChange={(e) => set("metric", e.target.value as never)}
            disabled={!canEdit}
            className={inp}
          >
            <option value="POINTS_EARNED">Points Earned</option>
            <option value="TASKS_COMPLETED">Tasks Completed</option>
            <option value="REFERRALS">Referrals</option>
            <option value="XP_EARNED">XP Earned</option>
          </select>
        </Field>

        {(["daily", "weekly", "monthly"] as const).map((period) => {
          const prizeKey = `${period}_prize` as keyof Values;
          const winnersKey = `${period}_winners` as keyof Values;
          const distributionKey = `${period}_distribution` as keyof Values;
          const winnerCount = Number(v[winnersKey] ?? 1);
          return (
            <div
              key={period}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white capitalize">
                  {period} Leaderboard
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Total Prize Pool (pts)">
                  <input
                    type="number"
                    min={0}
                    value={Number(v[prizeKey] ?? 0)}
                    onChange={(e) =>
                      set(prizeKey as never, (parseInt(e.target.value) || 0) as never)
                    }
                    disabled={!canEdit}
                    className={inp}
                  />
                </Field>
                <Field label="Number of Winners">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={winnerCount}
                    onChange={(e) =>
                      set(
                        winnersKey as never,
                        Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) as never
                      )
                    }
                    disabled={!canEdit}
                    className={inp}
                  />
                </Field>
              </div>
              {distributionField(
                period,
                winnerCount,
                (v[distributionKey] as number[]) ?? []
              )}
            </div>
          );
        })}

        <Field label="Minimum entries to publish leaderboard">
          <input
            type="number"
            min={1}
            value={Number(v.min_entries ?? 5)}
            onChange={(e) => set("min_entries", parseInt(e.target.value) || 5)}
            disabled={!canEdit}
            className={inp}
          />
        </Field>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!v.auto_reset}
            onChange={(e) => set("auto_reset", e.target.checked)}
            disabled={!canEdit}
            className="rounded bg-slate-800 border-slate-600 text-blue-500"
          />
          <span className="text-sm text-white">
            Auto-reset on schedule (recommended)
          </span>
        </label>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={save}
            disabled={!canEdit || busy}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>
      </div>

      {/* Manual reset controls */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Manual Reset Controls
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Use sparingly. Each reset selects winners and credits prizes from the
          configured distribution. A history row is added below.
        </p>
        <div className="flex flex-wrap gap-3">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => triggerReset(p)}
              disabled={!canEdit || resetting !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                p === "daily"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : p === "weekly"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
              }`}
            >
              {resetting === p ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : p === "monthly" ? (
                <Trophy className="w-4 h-4" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Past winners */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-1 inline-flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          Past Winners
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Last 10 cycles across all periods.
        </p>
        {historyLoading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : cycles.length === 0 ? (
          <div className="text-slate-500 text-sm py-6 text-center border border-dashed border-slate-800 rounded-lg">
            No past cycles yet. Run a reset to record one.
          </div>
        ) : (
          <div className="space-y-3">
            {cycles.map((c) => (
              <details
                key={c.cycleId}
                className="rounded-lg border border-slate-800 bg-slate-950"
              >
                <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                        c.period === "daily"
                          ? "bg-amber-500/10 text-amber-400"
                          : c.period === "weekly"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
                      {c.period}
                    </span>
                    <span className="text-sm text-white">
                      {format(new Date(c.cycledAt), "PP p")}
                    </span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {(c.winners?.length ?? 0)} winner{c.winners?.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-amber-400 text-sm font-bold tabular-nums">
                    {(c.totalPrize ?? 0).toLocaleString()} pts
                  </span>
                </summary>
                <div className="border-t border-slate-800 p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="text-left pb-2">Rank</th>
                        <th className="text-left pb-2">User</th>
                        <th className="text-right pb-2">{c.metric.replace(/_/g, " ")}</th>
                        <th className="text-right pb-2">Prize</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(c.winners ?? []).map((w) => (
                        <tr key={w.userId} className="border-t border-slate-800">
                          <td className="py-1.5 text-amber-400 font-bold">
                            #{w.rank}
                          </td>
                          <td className="py-1.5 text-white">{w.name}</td>
                          <td className="py-1.5 text-right text-slate-400 tabular-nums">
                            {w.value.toLocaleString()}
                          </td>
                          <td className="py-1.5 text-right text-emerald-400 font-semibold tabular-nums">
                            +{w.prize.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inp =
  "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-60";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
