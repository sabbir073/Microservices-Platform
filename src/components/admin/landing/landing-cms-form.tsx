"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  initial: Record<string, unknown>;
  canEdit: boolean;
}

interface PlanRow {
  name: string;
  task_rate: number;
  team_levels: number;
  extra_benefit?: number;
}

const DEFAULT_PLANS: PlanRow[] = [
  { name: "Free", task_rate: 0.02, team_levels: 0 },
  { name: "Starter", task_rate: 0.04, team_levels: 1 },
  { name: "Pro", task_rate: 0.06, team_levels: 2 },
  { name: "Elite", task_rate: 0.08, team_levels: 3 },
  { name: "VIP", task_rate: 0.1, team_levels: 3, extra_benefit: 1.5 },
];

const DEFAULTS = {
  // Hero
  hero_badge: "Trusted by 100,000+ users worldwide",
  hero_title_line1: "Earn Money Online",
  hero_title_line2: "From Anywhere",
  hero_subtitle:
    "Complete simple tasks, watch videos, share opinions, and build passive income with our AI-powered earning platform. Start earning in minutes.",
  hero_cta_primary: "Start Earning Now",
  hero_cta_secondary: "Watch Demo",
  // Calculator
  points_per_dollar: 1000,
  commission_l1: 10,
  commission_l2: 5,
  commission_l3: 2,
  plans: DEFAULT_PLANS,
};

type Mode = "hero" | "calculator";

export function LandingCmsForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("hero");
  const [v, setV] = useState({ ...DEFAULTS, ...initial });
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof typeof DEFAULTS>(k: K, val: (typeof DEFAULTS)[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const plans = (v.plans as PlanRow[]) ?? DEFAULT_PLANS;

  const updatePlan = (i: number, patch: Partial<PlanRow>) => {
    const next = plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    set("plans", next);
  };

  const removePlan = (i: number) => {
    set(
      "plans",
      plans.filter((_, idx) => idx !== i)
    );
  };

  const addPlan = () => {
    const name = window.prompt("New plan name?");
    if (!name?.trim()) return;
    set("plans", [...plans, { name: name.trim(), task_rate: 0.05, team_levels: 1 }]);
  };

  const save = async (which: Mode) => {
    setBusy(true);
    try {
      const settings: Record<string, unknown> = {};
      if (which === "hero") {
        for (const k of [
          "hero_badge",
          "hero_title_line1",
          "hero_title_line2",
          "hero_subtitle",
          "hero_cta_primary",
          "hero_cta_secondary",
        ] as const) {
          settings[`lp_${k}`] = v[k];
        }
      } else {
        for (const k of [
          "points_per_dollar",
          "commission_l1",
          "commission_l2",
          "commission_l3",
          "plans",
        ] as const) {
          settings[`lp_${k}`] = v[k];
        }
      }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "landing", settings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success(which === "hero" ? "Hero saved" : "Calculator saved");
      router.refresh();
    } catch (err) {
      toast.error("Failed to save", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="border-b border-slate-800 flex gap-1">
        <button
          onClick={() => setMode("hero")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px",
            mode === "hero"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          Hero Content
        </button>
        <button
          onClick={() => setMode("calculator")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px",
            mode === "calculator"
              ? "border-blue-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          Earnings Calculator
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? "Hide" : "Show"} Preview
        </button>
      </div>

      {mode === "hero" && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <Field label="Trust Badge">
            <input
              value={v.hero_badge as string}
              onChange={(e) => set("hero_badge", e.target.value)}
              disabled={!canEdit}
              className={inp}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title Line 1">
              <input
                value={v.hero_title_line1 as string}
                onChange={(e) => set("hero_title_line1", e.target.value)}
                disabled={!canEdit}
                className={inp}
              />
            </Field>
            <Field label="Title Line 2 (gradient)">
              <input
                value={v.hero_title_line2 as string}
                onChange={(e) => set("hero_title_line2", e.target.value)}
                disabled={!canEdit}
                className={inp}
              />
            </Field>
          </div>
          <Field label="Subtitle">
            <textarea
              rows={3}
              value={v.hero_subtitle as string}
              onChange={(e) => set("hero_subtitle", e.target.value)}
              disabled={!canEdit}
              className={inp + " resize-none"}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary CTA Text">
              <input
                value={v.hero_cta_primary as string}
                onChange={(e) => set("hero_cta_primary", e.target.value)}
                disabled={!canEdit}
                className={inp}
              />
            </Field>
            <Field label="Secondary CTA Text">
              <input
                value={v.hero_cta_secondary as string}
                onChange={(e) => set("hero_cta_secondary", e.target.value)}
                disabled={!canEdit}
                className={inp}
              />
            </Field>
          </div>

          {showPreview && (
            <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-center">
              <span className="inline-block mb-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs">
                ● {v.hero_badge as string}
              </span>
              <h2 className="text-3xl font-bold text-white">
                {v.hero_title_line1 as string}
              </h2>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {v.hero_title_line2 as string}
              </h2>
              <p className="text-slate-400 mt-3 text-sm max-w-xl mx-auto">
                {v.hero_subtitle as string}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm">
                  {v.hero_cta_primary as string} →
                </button>
                <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm">
                  ▶ {v.hero_cta_secondary as string}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => save("hero")}
              disabled={!canEdit || busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Hero Content
            </button>
          </div>
        </div>
      )}

      {mode === "calculator" && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Points per Dollar">
              <input
                type="number"
                min={1}
                value={Number(v.points_per_dollar ?? 1000)}
                onChange={(e) =>
                  set("points_per_dollar", parseInt(e.target.value) || 1000)
                }
                disabled={!canEdit}
                className={inp}
              />
            </Field>
            <Field label="L1 Commission %">
              <input
                type="number"
                min={0}
                max={100}
                value={Number(v.commission_l1 ?? 10)}
                onChange={(e) =>
                  set("commission_l1", parseInt(e.target.value) || 0)
                }
                disabled={!canEdit}
                className={inp}
              />
            </Field>
            <Field label="L2 Commission %">
              <input
                type="number"
                min={0}
                max={100}
                value={Number(v.commission_l2 ?? 5)}
                onChange={(e) =>
                  set("commission_l2", parseInt(e.target.value) || 0)
                }
                disabled={!canEdit}
                className={inp}
              />
            </Field>
            <Field label="L3 Commission %">
              <input
                type="number"
                min={0}
                max={100}
                value={Number(v.commission_l3 ?? 2)}
                onChange={(e) =>
                  set("commission_l3", parseInt(e.target.value) || 0)
                }
                disabled={!canEdit}
                className={inp}
              />
            </Field>
          </div>

          {/* Plans table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Plan Rates</p>
              <button
                onClick={addPlan}
                disabled={!canEdit}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add Plan
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-400">Plan</th>
                    <th className="text-left py-2 px-3 text-slate-400">
                      $/task
                    </th>
                    <th className="text-left py-2 px-3 text-slate-400">
                      Team Levels
                    </th>
                    <th className="text-left py-2 px-3 text-slate-400">
                      Extra Multiplier
                    </th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {plans.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3">
                        <input
                          value={p.name}
                          onChange={(e) =>
                            updatePlan(i, { name: e.target.value })
                          }
                          disabled={!canEdit}
                          className="bg-transparent border-0 outline-0 text-white w-full"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step={0.01}
                          value={p.task_rate}
                          onChange={(e) =>
                            updatePlan(i, {
                              task_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={!canEdit}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white w-24"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          max={3}
                          value={p.team_levels}
                          onChange={(e) =>
                            updatePlan(i, {
                              team_levels: parseInt(e.target.value) || 0,
                            })
                          }
                          disabled={!canEdit}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white w-20"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step={0.1}
                          value={p.extra_benefit ?? ""}
                          onChange={(e) =>
                            updatePlan(i, {
                              extra_benefit:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value),
                            })
                          }
                          disabled={!canEdit}
                          placeholder="—"
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white w-20"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        {canEdit && plans.length > 1 && (
                          <button
                            onClick={() => removePlan(i)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => save("calculator")}
              disabled={!canEdit || busy}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Calculator Config
            </button>
          </div>
        </div>
      )}
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
