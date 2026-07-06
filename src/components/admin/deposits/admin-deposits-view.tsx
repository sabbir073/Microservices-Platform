"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Deposit {
  id: string;
  amount: number;
  method: string;
  status: string;
  txnId: string | null;
  proofUrl: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export function AdminDepositsView() {
  const [status, setStatus] = useState("PENDING");
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = (s: string) => {
    setLoading(true);
    fetch(`/api/admin/deposits?status=${s}`)
      .then((r) => r.json())
      .then((d) => setDeposits(d.deposits ?? []))
      .catch(() => setDeposits([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load(status);
  }, [status]);

  const review = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm("Reject this deposit?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/deposits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Failed");
      toast.success(action === "approve" ? "Approved & credited" : "Rejected");
      load(status);
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Deposits</h1>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              status === s ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      )}

      {!loading && deposits.length === 0 && (
        <p className="text-sm text-slate-500 py-8 text-center">No {status.toLowerCase()} deposits.</p>
      )}

      <div className="space-y-2">
        {deposits.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                ${d.amount.toFixed(2)}{" "}
                <span className="text-slate-500 font-normal">· {d.method.replace("MANUAL_", "")}</span>
              </p>
              <p className="text-xs text-slate-400 truncate">
                {d.user?.name ?? d.user?.email ?? "Unknown"} · TXN {d.txnId ?? "—"}
              </p>
              {d.proofUrl && (
                <a
                  href={d.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 mt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  View proof
                </a>
              )}
            </div>
            {d.status === "PENDING" ? (
              <div className="flex gap-2">
                <button
                  onClick={() => review(d.id, "approve")}
                  disabled={busyId === d.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => review(d.id, "reject")}
                  disabled={busyId === d.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">{d.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
