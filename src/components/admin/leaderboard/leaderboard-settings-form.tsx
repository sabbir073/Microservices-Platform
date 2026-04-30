"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  initial: Record<string, unknown>;
  canEdit: boolean;
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
  min_entries: 5,
  auto_reset: true,
};

export function LeaderboardSettingsForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [v, setV] = useState({ ...DEFAULTS, ...initial });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof DEFAULTS>(k: K, val: (typeof DEFAULTS)[K]) =>
    setV((p) => ({ ...p, [k]: val }));

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

  const triggerReset = async (period: "daily" | "weekly" | "monthly") => {
    if (
      !window.confirm(
        `Reset ${period} leaderboard now? This selects winners and zeroes the period.`
      )
    )
      return;
    toast.info(`${period[0].toUpperCase() + period.slice(1)} leaderboard reset queued`, {
      description:
        "Reset job runs in Phase 5; current trigger only logs the request.",
    });
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Daily Prize Pool (pts)">
            <input
              type="number"
              min={0}
              value={Number(v.daily_prize ?? 0)}
              onChange={(e) =>
                set("daily_prize", parseInt(e.target.value) || 0)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Weekly Prize Pool (pts)">
            <input
              type="number"
              min={0}
              value={Number(v.weekly_prize ?? 0)}
              onChange={(e) =>
                set("weekly_prize", parseInt(e.target.value) || 0)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Monthly Prize Pool (pts)">
            <input
              type="number"
              min={0}
              value={Number(v.monthly_prize ?? 0)}
              onChange={(e) =>
                set("monthly_prize", parseInt(e.target.value) || 0)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Daily Winners">
            <input
              type="number"
              min={1}
              value={Number(v.daily_winners ?? 1)}
              onChange={(e) =>
                set("daily_winners", parseInt(e.target.value) || 1)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Weekly Winners">
            <input
              type="number"
              min={1}
              value={Number(v.weekly_winners ?? 3)}
              onChange={(e) =>
                set("weekly_winners", parseInt(e.target.value) || 3)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <Field label="Monthly Winners">
            <input
              type="number"
              min={1}
              value={Number(v.monthly_winners ?? 5)}
              onChange={(e) =>
                set("monthly_winners", parseInt(e.target.value) || 5)
              }
              disabled={!canEdit}
              className={inp}
            />
          </Field>
        </div>

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
          Use sparingly. Each reset selects winners and credits prizes.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => triggerReset("daily")}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Daily
          </button>
          <button
            onClick={() => triggerReset("weekly")}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Weekly
          </button>
          <button
            onClick={() => triggerReset("monthly")}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20"
          >
            <Trophy className="w-4 h-4" />
            Select Monthly Winners
          </button>
        </div>
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
