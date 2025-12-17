"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ListingActionsProps {
  listingId: string;
}

export function ListingActions({ listingId }: ListingActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/marketplace/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel listing");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Admin Actions</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Cancel Listing
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm text-amber-400 font-medium">Cancel this listing?</p>
              <p className="text-xs text-gray-500 mt-1">
                This will remove the listing from the marketplace. This action cannot be undone.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Reason for cancellation <span className="text-red-400">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Select a reason...</option>
              <option value="Violates marketplace policies">Violates marketplace policies</option>
              <option value="Inappropriate content">Inappropriate content</option>
              <option value="Fraudulent listing">Fraudulent listing</option>
              <option value="Copyright infringement">Copyright infringement</option>
              <option value="Seller request">Seller request</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowConfirm(false);
                setReason("");
                setError("");
              }}
              className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCancel}
              disabled={loading || !reason.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
