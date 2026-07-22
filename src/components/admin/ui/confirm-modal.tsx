"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "info";
  /** Require typing this text before the confirm button enables. */
  requireConfirmText?: string;
}

/**
 * Reusable destructive-action confirmation. Use for Delete / Ban / Reject /
 * Reset operations across the admin panel.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  requireConfirmText,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) return null;

  const cls = {
    danger: {
      icon: "bg-red-500/20 text-red-400",
      btn: "bg-red-600 hover:bg-red-700",
    },
    warning: {
      icon: "bg-amber-500/20 text-amber-400",
      btn: "bg-amber-600 hover:bg-amber-700",
    },
    info: {
      icon: "bg-blue-500/20 text-blue-400",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
  }[tone];

  const canConfirm =
    !requireConfirmText || typed.trim() === requireConfirmText.trim();

  const submit = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", cls.icon)}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {description && (
            <p className="text-sm text-slate-300">{description}</p>
          )}
          {requireConfirmText && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Type{" "}
                <code className="px-1.5 py-0.5 rounded bg-slate-900 text-white">
                  {requireConfirmText}
                </code>{" "}
                to confirm
              </label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={submit}
            disabled={busy || !canConfirm}
            className={cn(
              "flex-1 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2",
              cls.btn
            )}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
