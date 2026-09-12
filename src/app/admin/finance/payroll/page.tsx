import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, BadgeDollarSign, Landmark } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { usd } from "@/lib/utils";
import { StatCard } from "@/components/admin/stat-card";
import { PayrollSheetView } from "@/components/admin/finance/payroll-sheet";
import { BASES } from "@/lib/payroll/basis";
import { getPayrollConfig } from "@/lib/payroll/config";
import {
  getPayrollSheet,
  isPeriod,
  lastClosedPeriod,
  periodKey,
} from "@/lib/payroll/run";

export const dynamic = "force-dynamic";

/**
 * Payroll — the staff side of the business.
 *
 * The finance console tracks what the platform earns from users and pays to
 * users. It had nothing at all about what it pays its own people, which meant
 * the "Net" figure on the overview was revenue minus user payouts and nothing
 * else: a profit number with the wage bill left out of it.
 *
 * Read gate is `payroll.view`, pay gate is `payroll.manage`. Both sit inside
 * `FINANCE_PERMISSIONS`, so MANAGER — which holds everything except finance —
 * cannot be granted either.
 */

/** The last twelve closed periods plus the one running, newest first. */
function recentPeriods(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < 13; i++) {
    out.push(periodKey(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await can(session.user.id, "payroll.view"))) redirect("/admin");
  const canManage = await can(session.user.id, "payroll.manage");

  const sp = await searchParams;
  const period = isPeriod(sp.period) ? sp.period : lastClosedPeriod();
  const [sheet, config] = await Promise.all([
    getPayrollSheet(period),
    getPayrollConfig(),
  ]);

  const isOpenPeriod = period === periodKey(new Date());

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-amber-400" />
            Payroll
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Salaries and commissions for staff accounts. Periods are UTC
            calendar months.{" "}
            <Link href="/admin/finance" className="underline hover:text-white">
              <Landmark className="w-3.5 h-3.5 inline -mt-0.5" /> Finance
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {recentPeriods().map((p) => (
            <Link
              key={p}
              href={`/admin/finance/payroll?period=${p}`}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                p === period
                  ? "bg-amber-600 border-amber-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      </div>

      {!sheet.enabled && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-200/90">
            <b>Payroll is switched off.</b> The sheet below is live and correct,
            but nothing can be paid until you turn it on. That is deliberate:
            every rate ships at zero and nobody should be able to pay a salary
            by accident on a console that was never configured.
          </p>
        </div>
      )}

      {sheet.unconfigured && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-slate-300">
            <b>No salary and no commission rate has been set.</b> Every figure
            here reads $0.00 because the numbers are yours to choose — nothing
            in the code invents one. Set them under <b>Rates</b> below.
          </p>
        </div>
      )}

      {isOpenPeriod && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
          <p className="text-[12px] text-slate-300">
            <b>{period} has not closed yet.</b> Commission keeps accruing until
            the month ends, so paying now pays only what has been earned so far
            — and the period can then never be topped up, because a period pays
            exactly once.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Salaries due"
          value={usd(sheet.totals.salaryUsd)}
          subtext={`${period} · ${sheet.rows.length} staff on sheet`}
          icon={BadgeDollarSign}
          tone="blue"
        />
        <StatCard
          title="Commission earned"
          value={usd(sheet.totals.commissionUsd)}
          subtext="from work measured in this period"
          icon={BadgeDollarSign}
          tone="purple"
        />
        <StatCard
          title="Paid"
          value={usd(sheet.totals.paidUsd)}
          subtext="credited to staff wallets"
          icon={BadgeDollarSign}
          tone="green"
        />
        <StatCard
          title="Still owed"
          value={usd(sheet.totals.owedUsd)}
          subtext={sheet.totals.owedUsd > 0 ? "not yet paid" : "nothing outstanding"}
          icon={BadgeDollarSign}
          tone={sheet.totals.owedUsd > 0 ? "amber" : "slate"}
        />
      </div>

      <PayrollSheetView
        sheet={sheet}
        config={config}
        bases={BASES}
        canManage={canManage}
      />
    </div>
  );
}
