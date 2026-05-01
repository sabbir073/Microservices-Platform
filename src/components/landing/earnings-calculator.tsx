"use client";

import { useState } from "react";
import { Calculator, Sparkles, ArrowRight, Coins, Users, ListChecks } from "lucide-react";
import Link from "next/link";
import type { CalculatorContent, CalculatorPlan } from "@/lib/landing-content";
import { DEFAULT_LANDING_CONTENT } from "@/lib/landing-content";

const PLAN_GRADIENTS: Record<string, string> = {
  FREE: "from-slate-500 to-slate-600",
  STARTER: "from-blue-500 to-cyan-500",
  PRO: "from-purple-500 to-pink-500",
  ELITE: "from-amber-500 to-orange-500",
  VIP: "from-emerald-500 to-teal-500",
};

const FALLBACK_GRADIENT = "from-blue-500 to-purple-500";

function pickDefaultPlan(plans: CalculatorPlan[]): string {
  if (plans.length === 0) return "";
  return plans[0].name;
}

type Props = Partial<CalculatorContent>;

export function EarningsCalculator(props: Props) {
  const v: CalculatorContent = {
    ...DEFAULT_LANDING_CONTENT.calculator,
    ...props,
  };

  const [plan, setPlan] = useState<string>(() => pickDefaultPlan(v.plans));
  const [dailyTasks, setDailyTasks] = useState(50);
  const [l1, setL1] = useState(20);
  const [l2, setL2] = useState(40);
  const [l3, setL3] = useState(80);

  const activePlan =
    v.plans.find((p) => p.name === plan) ?? v.plans[0];

  const teamLevels = activePlan?.team_levels ?? 0;
  const supportsL1 = teamLevels >= 1;
  const supportsL2 = teamLevels >= 2;
  const supportsL3 = teamLevels >= 3;

  const dailyDirect =
    dailyTasks * (activePlan?.per_task ?? 0) * (activePlan?.multiplier ?? 1);
  const teamDailyBase = v.avg_team_tasks_per_day * v.avg_team_rate;
  const c1 = v.commission_l1 / 100;
  const c2 = v.commission_l2 / 100;
  const c3 = v.commission_l3 / 100;
  const effectiveL1 = supportsL1 ? l1 : 0;
  const effectiveL2 = supportsL2 ? l2 : 0;
  const effectiveL3 = supportsL3 ? l3 : 0;
  const dailyTeam =
    teamDailyBase * (effectiveL1 * c1 + effectiveL2 * c2 + effectiveL3 * c3);
  const dailyTotal = dailyDirect + dailyTeam;
  const calc = {
    dailyDirect,
    dailyTeam,
    dailyTotal,
    monthly: dailyTotal * 30,
    yearly: dailyTotal * 365,
  };

  return (
    <section id="calculator" className="relative py-16 sm:py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
            <Calculator className="w-3.5 h-3.5" />
            {v.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            {v.heading}
          </h2>
          <p className="text-slate-400 mt-2 max-w-xl mx-auto text-sm sm:text-base">
            {v.subheading}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Choose your plan
                </label>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(v.plans.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {v.plans.map((p) => {
                    const gradient =
                      PLAN_GRADIENTS[p.name] ?? FALLBACK_GRADIENT;
                    return (
                      <button
                        key={p.name}
                        onClick={() => setPlan(p.name)}
                        className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                          plan === p.name
                            ? `bg-linear-to-r ${gradient} text-white shadow-lg`
                            : "bg-white/5 text-slate-400 hover:bg-white/10"
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Rate: ${activePlan?.per_task ?? 0}/task ·{" "}
                  {activePlan?.multiplier ?? 1}× multiplier
                </p>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  <span>Daily tasks</span>
                  <span className="text-blue-400 tabular-nums">
                    {dailyTasks}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={5}
                  value={dailyTasks}
                  onChange={(e) => setDailyTasks(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Team size
                </label>

                {teamLevels === 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                    {activePlan?.name ?? "This"} plan does not support team
                    building. Upgrade to unlock referral commission.
                  </div>
                )}

                {(
                  [
                    {
                      key: "l1",
                      enabled: supportsL1,
                      label: `Level 1 (${v.commission_l1}%)`,
                      value: l1,
                      set: setL1,
                      color: "accent-emerald-500 text-emerald-400",
                    },
                    {
                      key: "l2",
                      enabled: supportsL2,
                      label: `Level 2 (${v.commission_l2}%)`,
                      value: l2,
                      set: setL2,
                      color: "accent-purple-500 text-purple-400",
                    },
                    {
                      key: "l3",
                      enabled: supportsL3,
                      label: `Level 3 (${v.commission_l3}%)`,
                      value: l3,
                      set: setL3,
                      color: "accent-amber-500 text-amber-400",
                    },
                  ] as const
                )
                  .filter((row) => row.enabled)
                  .map((row) => (
                    <div key={row.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">{row.label}</span>
                        <span
                          className={`tabular-nums font-bold ${row.color.split(" ")[1]}`}
                        >
                          {row.value}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={500}
                        step={5}
                        value={row.value}
                        onChange={(e) => row.set(Number(e.target.value))}
                        className={`w-full ${row.color.split(" ")[0]}`}
                      />
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-linear-to-br from-blue-600/10 via-purple-600/5 to-transparent">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Monthly Potential
                </p>
                <p className="text-5xl sm:text-6xl font-extrabold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tabular-nums mt-2">
                  ${calc.monthly.toFixed(0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ≈ ${calc.dailyTotal.toFixed(2)} / day
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <ListChecks className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    From Tasks
                  </p>
                  <p className="text-base font-bold text-white tabular-nums mt-0.5">
                    ${(calc.dailyDirect * 30).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    From Team
                  </p>
                  <p className="text-base font-bold text-white tabular-nums mt-0.5">
                    ${(calc.dailyTeam * 30).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <Coins className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Daily
                  </p>
                  <p className="text-base font-bold text-white tabular-nums mt-0.5">
                    ${calc.dailyTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                    Yearly Projection
                  </p>
                  <p className="text-lg font-extrabold text-white tabular-nums">
                    ${calc.yearly.toFixed(0)}
                  </p>
                </div>
              </div>

              <Link
                href="/register"
                className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-linear-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white text-sm font-bold transition-opacity"
              >
                🚀 Start Earning Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Estimates only · Actual earnings vary by activity
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
