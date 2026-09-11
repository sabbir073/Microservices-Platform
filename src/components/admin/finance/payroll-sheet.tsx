"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Loader2, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import { usd } from "@/lib/utils";
import type { BasisDef } from "@/lib/payroll/basis";
import type { CommissionRate, PayrollConfig, SalaryLine } from "@/lib/payroll/config";
import type { PayrollSheet, StaffPayrollRow } from "@/lib/payroll/run";

/**
 * The payroll sheet: who is owed what, and the button that pays them.
 *
 * The Pay button sends only who/period/which-component. The amount is
 * recomputed server-side from the saved rates and the measured activity, so
 * nothing on this screen can talk the server into paying a different number.
 */

type Rates = Record<string, CommissionRate>;
type Salaries = Record<string, SalaryLine>;

export function PayrollSheetView({
  sheet,
  config,
  bases,
  canManage,
}: {
  sheet: PayrollSheet;
  config: PayrollConfig;
  bases: BasisDef[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(config.enabled);
  const [rates, setRates] = useState<Rates>(() => {
    const out: Rates = {};
    for (const b of bases) {
      out[b.key] = config.commission[b.key] ?? { perUnitUsd: 0, percentOfValue: 0 };
    }
    return out;
  });
  const [salaries, setSalaries] = useState<Salaries>(() => {
    const out: Salaries = {};
    for (const r of sheet.rows) {
      out[r.userId] = config.salaries[r.userId] ?? {
        monthlyUsd: 0,
        title: "",
        startPeriod: "",
        endPeriod: "",
      };
    }
    return out;
  });

  const csvHref = useMemo(
    () => `/api/admin/payroll?period=${sheet.period}&format=csv`,
    [sheet.period]
  );

  async function save(patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || "Could not save");
      return false;
    }
    toast.success("Saved");
    start(() => router.refresh());
    return true;
  }

  async function pay(row: StaffPayrollRow, kind: "salary" | "commission") {
    const key = `${row.userId}:${kind}`;
    setBusy(key);
    try {
      const res = await fetch("/api/admin/payroll/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: sheet.period, userId: row.userId, kind }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        paidUsd?: number;
      };
      if (!res.ok) {
        toast.error(data.error || "Could not pay");
        return;
      }
      toast.success(
        `Paid ${usd(data.paidUsd ?? 0)} to ${row.name} — it is in their platform wallet now.`
      );
      start(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Rates ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white">Rates</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              What a staff member earns per item they handle. Every rate starts
              at zero — these are the owner&apos;s numbers, not defaults.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canManage}
              onChange={(e) => {
                setEnabled(e.target.checked);
                void save({ enabled: e.target.checked });
              }}
              className="w-4 h-4 accent-amber-500"
            />
            Payroll enabled
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                <th className="text-left py-2 pr-3">Basis</th>
                <th className="text-right py-2 px-3">Per item (USD)</th>
                <th className="text-right py-2 px-3">% of value</th>
                <th className="text-left py-2 pl-3">Read from</th>
              </tr>
            </thead>
            <tbody>
              {bases.map((b) => (
                <tr key={b.key} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3 text-slate-200 font-medium">{b.label}</td>
                  <td className="py-2 px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!canManage}
                      value={rates[b.key]?.perUnitUsd ?? 0}
                      onChange={(e) =>
                        setRates((r) => ({
                          ...r,
                          [b.key]: {
                            ...(r[b.key] ?? { perUnitUsd: 0, percentOfValue: 0 }),
                            perUnitUsd: Number(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    {b.hasValue ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        disabled={!canManage}
                        value={rates[b.key]?.percentOfValue ?? 0}
                        onChange={(e) =>
                          setRates((r) => ({
                            ...r,
                            [b.key]: {
                              ...(r[b.key] ?? { perUnitUsd: 0, percentOfValue: 0 }),
                              percentOfValue: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white"
                      />
                    ) : (
                      <span
                        className="text-[11px] text-slate-600"
                        title="This kind of item carries no money value, so a percentage of it would always be zero."
                      >
                        n/a
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-[11px] text-slate-500">{b.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => void save({ commission: rates })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> Save rates
          </button>
        )}
      </section>

      {/* ── Sheet ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Sheet — {sheet.period}
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Paying credits the staff member&apos;s <b>platform wallet</b>. They
              withdraw it through the normal withdrawal queue — there is no
              outbound payment rail on this platform, so nothing here pretends to
              send money to a bank.
            </p>
          </div>
          <a
            href={csvHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
        </div>

        {sheet.rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No staff activity and no salary configured for {sheet.period}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 pr-3">Staff</th>
                  <th className="text-right py-2 px-3">Salary</th>
                  <th className="text-right py-2 px-3">Commission</th>
                  <th className="text-right py-2 px-3">Paid</th>
                  <th className="text-right py-2 px-3">Owed</th>
                  <th className="text-right py-2 pl-3">Pay</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((r) => {
                  const isOpen = open === r.userId;
                  return (
                    <Fragment key={r.userId}>
                      <tr className="border-b border-slate-800/60">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : r.userId)}
                            className="flex items-center gap-1.5 text-left"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>
                              <span className="block text-slate-100 font-medium">
                                {r.name}
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {r.title || r.role} · {r.email}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {r.salaryConfigured ? (
                            usd(r.salaryUsd)
                          ) : (
                            <span className="text-[11px] text-slate-600">not set</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {usd(r.commissionUsd)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          {usd(r.salaryPaidUsd + r.commissionPaidUsd)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            r.owedUsd > 0 ? "text-amber-300" : "text-slate-500"
                          }`}
                        >
                          {usd(r.owedUsd)}
                        </td>
                        <td className="py-2 pl-3 text-right whitespace-nowrap">
                          <PayButton
                            label="Salary"
                            disabled={
                              !canManage ||
                              !sheet.enabled ||
                              r.salaryPaidUsd > 0 ||
                              r.salaryUsd <= 0
                            }
                            paid={r.salaryPaidUsd > 0}
                            busy={busy === `${r.userId}:salary`}
                            onClick={() => void pay(r, "salary")}
                          />
                          <PayButton
                            label="Commission"
                            disabled={
                              !canManage ||
                              !sheet.enabled ||
                              r.commissionPaidUsd > 0 ||
                              r.commissionUsd <= 0
                            }
                            paid={r.commissionPaidUsd > 0}
                            busy={busy === `${r.userId}:commission`}
                            onClick={() => void pay(r, "commission")}
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={6} className="p-3">
                            <Detail
                              row={r}
                              canManage={canManage}
                              salary={
                                salaries[r.userId] ?? {
                                  monthlyUsd: 0,
                                  title: "",
                                  startPeriod: "",
                                  endPeriod: "",
                                }
                              }
                              onSalary={(line) =>
                                setSalaries((s) => ({ ...s, [r.userId]: line }))
                              }
                              onSave={() =>
                                void save({
                                  salaries: {
                                    ...config.salaries,
                                    [r.userId]: salaries[r.userId],
                                  },
                                })
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pending && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> refreshing…
          </p>
        )}
      </section>
    </div>
  );
}

function PayButton({
  label,
  disabled,
  paid,
  busy,
  onClick,
}: {
  label: string;
  disabled: boolean;
  paid: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
        paid
          ? "bg-emerald-950/40 text-emerald-500 border border-emerald-900/60"
          : disabled
            ? "bg-slate-800 text-slate-600 border border-slate-800"
            : "bg-emerald-600 hover:bg-emerald-500 text-white"
      }`}
    >
      {busy && <Loader2 className="w-3 h-3 animate-spin" />}
      {paid ? `${label} paid` : label}
    </button>
  );
}

function Detail({
  row,
  canManage,
  salary,
  onSalary,
  onSave,
}: {
  row: StaffPayrollRow;
  canManage: boolean;
  salary: SalaryLine;
  onSalary: (line: SalaryLine) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
          Commission basis
        </p>
        <table className="w-full text-[12px]">
          <tbody>
            {row.lines.map((l) => (
              <tr key={l.key} className="border-b border-slate-800/40">
                <td className="py-1 pr-2 text-slate-300">{l.label}</td>
                <td className="py-1 px-2 text-right text-slate-400">
                  {l.count} {l.unit}
                  {l.count === 1 ? "" : "s"}
                </td>
                <td className="py-1 px-2 text-right text-slate-500">
                  {l.valueUsd > 0 ? usd(l.valueUsd) : "—"}
                </td>
                <td className="py-1 pl-2 text-right text-slate-200">
                  {usd(l.earnedUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {row.commissionPaidAt && (
          <p className="text-[11px] text-emerald-500 mt-2">
            Commission paid {new Date(row.commissionPaidAt).toUTCString()}
          </p>
        )}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
          Salary terms
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-400">
            Per month (USD)
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={!canManage}
              value={salary.monthlyUsd}
              onChange={(e) =>
                onSalary({ ...salary, monthlyUsd: Number(e.target.value) || 0 })
              }
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Title
            <input
              type="text"
              disabled={!canManage}
              value={salary.title}
              onChange={(e) => onSalary({ ...salary, title: e.target.value })}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            From (YYYY-MM)
            <input
              type="text"
              placeholder="2026-09"
              disabled={!canManage}
              value={salary.startPeriod}
              onChange={(e) => onSalary({ ...salary, startPeriod: e.target.value })}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
            />
          </label>
          <label className="text-[11px] text-slate-400">
            Until (YYYY-MM)
            <input
              type="text"
              placeholder="open"
              disabled={!canManage}
              value={salary.endPeriod}
              onChange={(e) => onSalary({ ...salary, endPeriod: e.target.value })}
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Leave <b>From</b> empty and the salary counts as owed for every month
          in history, including the ones before this person was hired.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={onSave}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> Save salary
          </button>
        )}
        {row.salaryPaidAt && (
          <p className="text-[11px] text-emerald-500 mt-2">
            Salary paid {new Date(row.salaryPaidAt).toUTCString()}
          </p>
        )}
      </div>
    </div>
  );
}
