"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  XCircle,
  Trophy,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface LotteryActionsProps {
  lotteryId: string;
  status: string;
  ticketsSold: number;
}

export function LotteryActions({ lotteryId, status, ticketsSold }: LotteryActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/lottery/${lotteryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} lottery`);
      }

      setSuccess(data.message || `Lottery ${action} successfully`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setShowConfirm(null);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}

      {!showConfirm ? (
        <div className="space-y-3">
          {status === "UPCOMING" && (
            <button
              onClick={() => handleAction("activate")}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Activate Lottery
            </button>
          )}

          {status === "ACTIVE" && (
            <>
              <button
                onClick={() => setShowConfirm("draw")}
                disabled={loading || ticketsSold === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trophy className="w-4 h-4" />
                Draw Winners
              </button>
              {ticketsSold === 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Cannot draw without sold tickets
                </p>
              )}
            </>
          )}

          {(status === "UPCOMING" || status === "ACTIVE") && (
            <button
              onClick={() => setShowConfirm("cancel")}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancel Lottery
            </button>
          )}

          {status === "COMPLETED" && (
            <div className="text-center text-gray-500 py-4">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p>This lottery has been completed</p>
            </div>
          )}

          {status === "CANCELLED" && (
            <div className="text-center text-gray-500 py-4">
              <XCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p>This lottery was cancelled</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm text-amber-400 font-medium">
                {showConfirm === "draw"
                  ? "Draw winners now?"
                  : "Cancel this lottery?"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {showConfirm === "draw"
                  ? "This will randomly select winners and distribute prizes. This action cannot be undone."
                  : "Cancelled lotteries cannot be reactivated. All sold tickets will be refunded."}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(null)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction(showConfirm)}
              disabled={loading}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                showConfirm === "draw"
                  ? "bg-purple-500 hover:bg-purple-600"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showConfirm === "draw" ? (
                <Trophy className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
