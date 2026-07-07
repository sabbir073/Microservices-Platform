"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, RefreshCw, X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Callback {
  id: string;
  userId: string;
  offerwallId: string;
  offerId: string | null;
  offerName: string | null;
  transactionId: string;
  payoutAmount: number;
  userPayout: number;
  status: string;
  fraudScore: number;
  fraudReasons: string[];
  ipAddress: string | null;
  countryCode: string | null;
  rejectionReason: string | null;
  reviewNote: string | null;
  createdAt: string;
}

interface UserInfo {
  name: string | null;
  email: string;
  avatar: string | null;
}

interface Props {
  callbacks: Callback[];
  users: Record<string, UserInfo>;
  userMap: Record<string, UserInfo>;
  providers: { id: string; provider: string }[];
  canManage: boolean;
  currentFilters: { status: string; offerwall: string; q: string };
  pagination: { page: number; pageSize: number; total: number };
}

const STATUSES = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FRAUD",
  "CHARGEBACK",
];

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-400",
  REJECTED: "bg-red-500/15 text-red-400",
  FRAUD: "bg-orange-500/15 text-orange-400",
  CHARGEBACK: "bg-purple-500/15 text-purple-400",
};

function fraudTone(score: number) {
  if (score < 40) return "text-emerald-400";
  if (score < 70) return "text-amber-400";
  return "text-red-400";
}

export function OfferwallCallbacksClient({
  callbacks,
  userMap,
  providers,
  canManage,
  currentFilters,
  pagination,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(currentFilters.q);
  const [active, setActive] = useState<Callback | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const providerMap = useMemo(
    () => Object.fromEntries(providers.map((p) => [p.id, p.provider])),
    [providers]
  );

  const update = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "ALL") params.delete(k);
      else params.set(k, v);
    }
    if (!("page" in patch)) params.delete("page");
    router.push(`/admin/offerwall-callbacks?${params.toString()}`);
  };

  const refresh = async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.pageSize)
  );

  return (
    <>
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update({ q })}
            placeholder="Search transaction ID, offer name, offer ID…"
            className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={currentFilters.status}
            onChange={(e) => update({ status: e.target.value })}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={currentFilters.offerwall}
            onChange={(e) => update({ offerwall: e.target.value })}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="ALL">All Providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {callbacks.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <p className="text-slate-400">No callbacks match these filters.</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  User
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Provider
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Transaction
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Payout
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Fraud
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  When
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {callbacks.map((c) => {
                const u = userMap[c.userId];
                return (
                  <tr
                    key={c.id}
                    onClick={() => setActive(c)}
                    className="hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm text-white truncate max-w-45">
                        {u?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-45">
                        {u?.email}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-300">
                      {providerMap[c.offerwallId]?.replace(/_/g, " ") ??
                        c.offerwallId}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">
                      {c.transactionId.slice(0, 12)}…
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="text-emerald-400 font-bold tabular-nums">
                        {c.userPayout.toLocaleString()} pts
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        ${c.payoutAmount.toFixed(2)}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-sm font-bold tabular-nums ${fraudTone(
                          c.fraudScore
                        )}`}
                      >
                        {c.fraudScore}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_TONE[c.status] ??
                          "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(c.createdAt), "MMM d, HH:mm")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <p>
            Page {pagination.page} of {totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() =>
                update({ page: String(Math.max(1, pagination.page - 1)) })
              }
              className="px-3 py-1.5 bg-slate-800 text-white rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={pagination.page >= totalPages}
              onClick={() => update({ page: String(pagination.page + 1) })}
              className="px-3 py-1.5 bg-slate-800 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {active && (
        <CallbackModal
          callback={active}
          user={userMap[active.userId]}
          providerName={providerMap[active.offerwallId]}
          canManage={canManage}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

function CallbackModal({
  callback,
  user,
  providerName,
  canManage,
  onClose,
}: {
  callback: Callback;
  user: UserInfo | undefined;
  providerName: string | undefined;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState(callback.reviewNote ?? "");

  const review = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !note.trim()) {
      toast.error("Review note required for rejection");
      return;
    }
    setBusy(action.toLowerCase() as "approve" | "reject");
    try {
      const res = await fetch(`/api/admin/offerwall-callbacks/${callback.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success(action === "APPROVE" ? "Approved" : "Rejected");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const isPending = callback.status === "PENDING";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Callback Detail</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {callback.transactionId}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="User Payout"
              value={`${callback.userPayout.toLocaleString()} pts`}
              tone="text-emerald-400"
            />
            <Stat
              label="Provider Payout"
              value={`$${callback.payoutAmount.toFixed(2)}`}
              tone="text-blue-400"
            />
            <Stat
              label="Fraud Score"
              value={callback.fraudScore.toString()}
              tone={fraudTone(callback.fraudScore)}
            />
          </div>

          {callback.fraudReasons.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-2">
                Fraud Reasons ({callback.fraudReasons.length})
              </p>
              <ul className="text-sm text-amber-300 space-y-1">
                {callback.fraudReasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm space-y-2">
            <Row label="User">
              {user
                ? `${user.name ?? "Unknown"} (${user.email})`
                : callback.userId}
            </Row>
            <Row label="Provider">
              {providerName?.replace(/_/g, " ") ?? callback.offerwallId}
            </Row>
            <Row label="Offer">
              {callback.offerName ?? callback.offerId ?? "—"}
            </Row>
            <Row label="IP Address">
              <span className="font-mono text-xs">
                {callback.ipAddress ?? "—"}
              </span>
            </Row>
            <Row label="Country">{callback.countryCode ?? "—"}</Row>
            <Row label="Status">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_TONE[callback.status] ?? "bg-slate-700 text-slate-300"
                }`}
              >
                {callback.status}
              </span>
            </Row>
            {callback.rejectionReason && (
              <Row label="Rejection Reason">
                <span className="text-red-400">{callback.rejectionReason}</span>
              </Row>
            )}
          </div>

          {canManage && isPending && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                Review Note (required for rejection)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Confirmed legit completion, no fraud signals."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}

          {!isPending && callback.reviewNote && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">
                Review Note
              </p>
              <p className="text-slate-300">{callback.reviewNote}</p>
            </div>
          )}
        </div>

        {canManage && isPending && (
          <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
            <button
              onClick={() => review("REJECT")}
              disabled={busy !== null || !note.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {busy === "reject" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Reject
            </button>
            <button
              onClick={() => review("APPROVE")}
              disabled={busy !== null}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "approve" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Approve & Credit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-slate-500 shrink-0">{label}</p>
      <p className="text-slate-200 text-right break-all">{children}</p>
    </div>
  );
}
