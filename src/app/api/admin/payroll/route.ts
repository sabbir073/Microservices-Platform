import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { csvFilename, csvResponse, toCsv } from "@/lib/csv";
import { usd } from "@/lib/utils";
import {
  getPayrollConfig,
  savePayrollConfig,
  type CommissionRate,
  type SalaryLine,
} from "@/lib/payroll/config";
import { BASES, BASIS_KEYS } from "@/lib/payroll/basis";
import { getPayrollSheet, isPeriod, lastClosedPeriod } from "@/lib/payroll/run";

/**
 * The payroll sheet, and the rates behind it.
 *
 * Gated on `payroll.view` / `payroll.manage`, both of which are listed in
 * `FINANCE_PERMISSIONS`. That matters more than it looks: `stripProtectedForRole`
 * hard-strips everything in that list from anyone who is not SUPER_ADMIN or the
 * built-in FINANCE_ADMIN, so a MANAGER — who holds every other permission on the
 * platform — cannot be granted payroll by a mis-saved role matrix or a per-user
 * override. Adding a permission outside that list would have been a new door
 * into finance.
 */

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(await can(session.user.id, "payroll.view"))) {
    return bad("Forbidden", 403);
  }

  const sp = new URL(request.url).searchParams;
  const period = sp.get("period");
  const p = isPeriod(period) ? period : lastClosedPeriod();

  const [sheet, config] = await Promise.all([
    getPayrollSheet(p),
    getPayrollConfig(),
  ]);

  if (sp.get("format") === "csv") {
    // The per-basis counts are columns too: a payroll CSV that shows a
    // commission total with no way to see what it was earned on is a number an
    // accountant cannot check.
    const basisLabels = BASES.map((b) => b.label);
    const headers = [
      "Period", "Name", "Email", "Role", "Title",
      "Salary", "Commission", "Salary paid", "Salary paid at",
      "Commission paid", "Commission paid at", "Owed",
      ...basisLabels,
    ];
    const rows = sheet.rows.map((r) => [
      p,
      r.name,
      r.email,
      r.role,
      r.title,
      usd(r.salaryUsd),
      usd(r.commissionUsd),
      usd(r.salaryPaidUsd),
      r.salaryPaidAt ?? "",
      usd(r.commissionPaidUsd),
      r.commissionPaidAt ?? "",
      usd(r.owedUsd),
      ...BASES.map((b) => r.lines.find((l) => l.key === b.key)?.count ?? 0),
    ]);
    return csvResponse(toCsv(headers, rows), csvFilename(`payroll-${p}`));
  }

  return NextResponse.json({ sheet, config, bases: BASIS_KEYS });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(await can(session.user.id, "payroll.manage"))) {
    return bad("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON");
  }
  const b = (body ?? {}) as {
    enabled?: unknown;
    salaries?: unknown;
    commission?: unknown;
    overrides?: unknown;
  };

  const patch: {
    enabled?: boolean;
    salaries?: Record<string, SalaryLine>;
    commission?: Record<string, CommissionRate>;
    overrides?: Record<string, Record<string, CommissionRate>>;
  } = {};
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  // Shapes are re-validated and clamped inside savePayrollConfig — this is the
  // handoff, not the validation.
  if (b.salaries && typeof b.salaries === "object") {
    patch.salaries = b.salaries as Record<string, SalaryLine>;
  }
  if (b.commission && typeof b.commission === "object") {
    patch.commission = b.commission as Record<string, CommissionRate>;
  }
  if (b.overrides && typeof b.overrides === "object") {
    patch.overrides = b.overrides as Record<string, Record<string, CommissionRate>>;
  }
  if (Object.keys(patch).length === 0) return bad("Nothing to save");

  const before = await getPayrollConfig();
  await savePayrollConfig(patch);
  const after = await getPayrollConfig();

  // A salary change is a change to ONE person's pay, so it is audited against
  // that person — a payroll edit that names nobody is invisible on the account
  // it affected, which is the exact gap the admin-oversight pass closed.
  const changed = new Set<string>();
  for (const id of new Set([
    ...Object.keys(before.salaries),
    ...Object.keys(after.salaries),
  ])) {
    const a = before.salaries[id];
    const c = after.salaries[id];
    if (
      (a?.monthlyUsd ?? 0) !== (c?.monthlyUsd ?? 0) ||
      (a?.title ?? "") !== (c?.title ?? "") ||
      (a?.startPeriod ?? "") !== (c?.startPeriod ?? "") ||
      (a?.endPeriod ?? "") !== (c?.endPeriod ?? "")
    ) {
      changed.add(id);
    }
  }
  for (const id of Object.keys(after.overrides)) {
    if (
      JSON.stringify(after.overrides[id]) !==
      JSON.stringify(before.overrides[id] ?? {})
    ) {
      changed.add(id);
    }
  }

  if (changed.size === 0) {
    await writeAudit({
      actorId: session.user.id,
      action: "PAYROLL_CONFIG_UPDATED",
      entity: "Payroll",
      entityId: "config",
      targetUserId: session.user.id,
      summary: "Updated platform-wide payroll rates",
      meta: { before: before.commission, after: after.commission, enabled: after.enabled },
    });
  } else {
    for (const id of changed) {
      await writeAudit({
        actorId: session.user.id,
        action: "PAYROLL_CONFIG_UPDATED",
        entity: "Payroll",
        entityId: id,
        targetUserId: id,
        summary: `Payroll terms changed — salary ${usd(
          before.salaries[id]?.monthlyUsd ?? 0
        )} → ${usd(after.salaries[id]?.monthlyUsd ?? 0)} per month`,
        meta: {
          before: { salary: before.salaries[id] ?? null, overrides: before.overrides[id] ?? null },
          after: { salary: after.salaries[id] ?? null, overrides: after.overrides[id] ?? null },
        },
      });
    }
  }

  return NextResponse.json({ ok: true, config: after });
}
