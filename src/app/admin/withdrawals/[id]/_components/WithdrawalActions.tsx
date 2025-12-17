"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface WithdrawalActionsProps {
  withdrawalId: string;
  amount: number;
  method: string;
}

export function WithdrawalActions({ withdrawalId, amount, method }: WithdrawalActionsProps) {
  const router = useRouter();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleApprove = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          transactionId: transactionId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve withdrawal");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejectionReason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject withdrawal");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Process Withdrawal</h2>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!action && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Amount to pay: <span className="text-white font-semibold">${amount.toFixed(2)}</span> via {method}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setAction("approve")}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => setAction("reject")}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {action === "approve" && (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <p className="text-sm text-emerald-400">
              Approving this withdrawal will mark it as completed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Transaction Reference (optional)
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter payment reference ID..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setAction(null);
                setError("");
              }}
              className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Confirm Approval
            </button>
          </div>
        </div>
      )}

      {action === "reject" && (
        <div className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              Rejecting this withdrawal will refund the amount to the user&apos;s balance.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500 mb-2"
            >
              <option value="">Select a reason...</option>
              <option value="Invalid payment details">Invalid payment details</option>
              <option value="KYC verification required">KYC verification required</option>
              <option value="Suspected fraudulent activity">Suspected fraudulent activity</option>
              <option value="Insufficient account verification">Insufficient account verification</option>
              <option value="Payment method not supported">Payment method not supported</option>
              <option value="Other">Other (specify below)</option>
            </select>
            {rejectionReason === "Other" && (
              <textarea
                value=""
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter custom rejection reason..."
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
              />
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setAction(null);
                setRejectionReason("");
                setError("");
              }}
              className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={loading || !rejectionReason.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Confirm Rejection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
