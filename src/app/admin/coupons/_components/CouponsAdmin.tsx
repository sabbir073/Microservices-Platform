"use client";

import { confirmDialog } from "@/lib/confirm";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Save,
  Trash2,
  Tag,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "ALL" | "CATEGORY" | "SPECIFIC_COURSES";
  categoryIds: string[];
  courseIds: string[];
  minPurchase: number | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  perUserLimit: number;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
}

interface Props {
  initial: Coupon[];
  categories: Array<{ id: string; name: string; slug: string }>;
  courses: Array<{ id: string; title: string }>;
  canManage: boolean;
}

export function CouponsAdmin({ initial, categories, courses, canManage }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            New coupon
          </button>
        </div>
      )}

      {creating && (
        <CouponForm
          categories={categories}
          courses={courses}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Discount</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Used / Limit</th>
                <th className="text-left px-4 py-3">Validity</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initial.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No coupons yet.
                  </td>
                </tr>
              )}
              {initial.map((c) => (
                <CouponRow
                  key={c.id}
                  coupon={c}
                  canManage={canManage}
                  onChanged={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CouponRow({
  coupon,
  canManage,
  onChanged,
}: {
  coupon: Coupon;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success(coupon.isActive ? "Coupon paused" : "Coupon activated");
      onChanged();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: `Delete coupon "${coupon.code}"?`, description: "Past redemptions stay intact.", tone: "danger", confirmLabel: "Delete" }))) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "DELETE",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success("Coupon deleted");
      onChanged();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="hover:bg-slate-800/40">
      <td className="px-4 py-3 font-mono text-indigo-300">{coupon.code}</td>
      <td className="px-4 py-3 text-white font-bold tabular-nums">
        {coupon.type === "PERCENT"
          ? `${coupon.value}%`
          : `$${coupon.value.toFixed(2)}`}
      </td>
      <td className="px-4 py-3 text-slate-300 text-xs">
        {coupon.scope === "ALL"
          ? "All courses"
          : coupon.scope === "CATEGORY"
          ? `${coupon.categoryIds.length} categor${coupon.categoryIds.length === 1 ? "y" : "ies"}`
          : `${coupon.courseIds.length} course${coupon.courseIds.length === 1 ? "" : "s"}`}
      </td>
      <td className="px-4 py-3 text-slate-300 tabular-nums">
        {coupon.redemptionsCount}
        {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs">
        {new Date(coupon.validFrom).toLocaleDateString()}
        {coupon.validUntil
          ? ` → ${new Date(coupon.validUntil).toLocaleDateString()}`
          : " → ∞"}
      </td>
      <td className="px-4 py-3">
        {coupon.isActive ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
            Active
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-400 text-xs font-medium">
            Inactive
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {coupon.isActive ? (
                <ToggleRight className="w-4 h-4 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-slate-500" />
              )}
              {coupon.isActive ? "Pause" : "Activate"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CouponForm({
  categories,
  courses,
  onClose,
  onSaved,
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  courses: Array<{ id: string; title: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState<string>("10");
  const [scope, setScope] = useState<"ALL" | "CATEGORY" | "SPECIFIC_COURSES">("ALL");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [minPurchase, setMinPurchase] = useState<string>("");
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [perUserLimit, setPerUserLimit] = useState<string>("1");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const upper = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,60}$/.test(upper)) {
      toast.error("Code: 3–60 chars, uppercase letters / numbers / - / _");
      return;
    }
    const numericValue = parseFloat(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Discount value must be > 0");
      return;
    }
    if (type === "PERCENT" && numericValue > 100) {
      toast.error("Percent can't exceed 100");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: upper,
          type,
          value: numericValue,
          scope,
          categoryIds: scope === "CATEGORY" ? categoryIds : [],
          courseIds: scope === "SPECIFIC_COURSES" ? courseIds : [],
          minPurchase: minPurchase ? parseFloat(minPurchase) : null,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
          perUserLimit: parseInt(perUserLimit, 10) || 1,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success("Coupon created");
      onSaved();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-indigo-500/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white inline-flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-300" />
          New coupon
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Code">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className={inputCls + " font-mono uppercase"}
            maxLength={60}
          />
        </Field>
        <Field label="Discount type">
          <div className="grid grid-cols-2 gap-1">
            <SegBtn active={type === "PERCENT"} onClick={() => setType("PERCENT")}>
              Percent
            </SegBtn>
            <SegBtn active={type === "FIXED"} onClick={() => setType("FIXED")}>
              Fixed $
            </SegBtn>
          </div>
        </Field>
        <Field label={type === "PERCENT" ? "Percent off" : "Dollars off"}>
          <input
            type="number"
            min={0}
            step={type === "PERCENT" ? 1 : 0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls + " tabular-nums"}
          />
        </Field>
        <Field label="Scope">
          <select
            value={scope}
            onChange={(e) =>
              setScope(e.target.value as typeof scope)
            }
            className={inputCls}
          >
            <option value="ALL">All courses</option>
            <option value="CATEGORY">Specific categories</option>
            <option value="SPECIFIC_COURSES">Specific courses</option>
          </select>
        </Field>
      </div>

      {scope === "CATEGORY" && (
        <Field label="Categories">
          <select
            multiple
            value={categoryIds}
            onChange={(e) =>
              setCategoryIds(
                Array.from(e.target.selectedOptions, (o) => o.value)
              )
            }
            className={inputCls + " min-h-[120px]"}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {scope === "SPECIFIC_COURSES" && (
        <Field label="Courses">
          <select
            multiple
            value={courseIds}
            onChange={(e) =>
              setCourseIds(Array.from(e.target.selectedOptions, (o) => o.value))
            }
            className={inputCls + " min-h-[140px]"}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Min purchase ($)">
          <input
            type="number"
            min={0}
            step={0.5}
            value={minPurchase}
            onChange={(e) => setMinPurchase(e.target.value)}
            className={inputCls + " tabular-nums"}
            placeholder="—"
          />
        </Field>
        <Field label="Max redemptions">
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            className={inputCls + " tabular-nums"}
            placeholder="∞"
          />
        </Field>
        <Field label="Per-user limit">
          <input
            type="number"
            min={0}
            max={100}
            value={perUserLimit}
            onChange={(e) => setPerUserLimit(e.target.value)}
            className={inputCls + " tabular-nums"}
          />
        </Field>
        <Field label="Valid from">
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Valid until">
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Create coupon
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-2 rounded-lg text-xs font-bold border " +
        (active
          ? "border-indigo-500 bg-indigo-500/15 text-white"
          : "border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300")
      }
    >
      {children}
    </button>
  );
}
