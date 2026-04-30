"use client";

import { useMemo, useState } from "react";
import { Calculator, Sparkles, ArrowRight, Coins, Users, ListChecks } from "lucide-react";
import Link from "next/link";

type Plan = "FREE" | "STARTER" | "PRO" | "ELITE" | "VIP";

const PLAN_RATES: Record<Plan, { perTask: number; multiplier: number; color: string }> = {
  FREE: { perTask: 0.02, multiplier: 1, color: "from-slate-500 to-slate-600" },
  STARTER: { perTask: 0.04, multiplier: 1.1, color: "from-blue-500 to-cyan-500" },
  PRO: { perTask: 0.06, multiplier: 1.25, color: "from-purple-500 to-pink-500" },
  ELITE: { perTask: 0.08, multiplier: 1.4, color: "from-amber-500 to-orange-500" },
  VIP: { perTask: 0.1, multiplier: 1.5, color: "from-emerald-500 to-teal-500" },
};

const COMMISSION = { l1: 0.1, l2: 0.05, l3: 0.02 };
const AVG_TEAM_TASKS_PER_DAY = 20;
const AVG_TEAM_RATE = 0.02;

export function EarningsCalculator() {
  const [plan, setPlan] = useState<Plan>("PRO");
  const [dailyTasks, setDailyTasks] = useState(50);
  const [l1, setL1] = useState(20);
  const [l2, setL2] = useState(40);
  const [l3, setL3] = useState(80);

  const calc = useMemo(() => {
    const cfg = PLAN_RATES[plan];
    const dailyDirect = dailyTasks * cfg.perTask * cfg.multiplier;
    const teamDailyBase = AVG_TEAM_TASKS_PER_DAY * AVG_TEAM_RATE;
    const dailyTeam =
      teamDailyBase *
      (l1 * COMMISSION.l1 + l2 * COMMISSION.l2 + l3 * COMMISSION.l3);
    const dailyTotal = dailyDirect + dailyTeam;
    const monthly = dailyTotal * 30;
    const yearly = dailyTotal * 365;
    return {
      dailyDirect,
      dailyTeam,
      dailyTotal,
      monthly,
      yearly,
    };
  }, [plan, dailyTasks, l1, l2, l3]);

  return (
    <section
      id="calculator"
      className="relative py-16 sm:py-24 px-4"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
            <Calculator className="w-3.5 h-3.5" />
            Earnings Calculator
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            See your earning potential
          </h2>
          <p className="text-slate-400 mt-2 max-w-xl mx-auto text-sm sm:text-base">
            Adjust your plan, daily tasks, and team size to estimate your monthly earnings.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-0">
            {/* Inputs */}
            <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/10 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Choose your plan
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {(Object.keys(PLAN_RATES) as Plan[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className={`px-1 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                        plan === p
                          ? `bg-gradient-to-r ${PLAN_RATES[p].color} text-white shadow-lg`
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Rate: ${PLAN_RATES[plan].perTask}/task ·{" "}
                  {PLAN_RATES[plan].multiplier}× multiplier
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
                {(
                  [
                    {
                      label: "Level 1 (10%)",
                      value: l1,
                      set: setL1,
                      color: "accent-emerald-500 text-emerald-400",
                    },
                    {
                      label: "Level 2 (5%)",
                      value: l2,
                      set: setL2,
                      color: "accent-purple-500 text-purple-400",
                    },
                    {
                      label: "Level 3 (2%)",
                      value: l3,
                      set: setL3,
                      color: "accent-amber-500 text-amber-400",
                    },
                  ] as const
                ).map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">{row.label}</span>
                      <span className={`tabular-nums font-bold ${row.color.split(" ")[1]}`}>
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

            {/* Results */}
            <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Monthly Potential
                </p>
                <p className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tabular-nums mt-2">
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
                className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white text-sm font-bold transition-opacity"
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
