"use client";

import { confirmDialog } from "@/lib/confirm";

import { useState } from "react";
import {
  Mail,
  Coins,
  Crown,
  Ban,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  /**
   * Caller registers handlers for any of the bulk actions; missing handlers
   * are not rendered.
   */
  handlers: {
    sendEmail?: (ids: string[]) => Promise<void> | void;
    adjustPoints?: (ids: string[]) => Promise<void> | void;
    changeTier?: (ids: string[]) => Promise<void> | void;
    banSelected?: (ids: string[]) => Promise<void> | void;
    deleteSelected?: (ids: string[]) => Promise<void> | void;
  };
}

interface BulkAction {
  key: keyof BulkActionsBarProps["handlers"];
  label: string;
  icon: typeof Mail;
  tone: "default" | "danger";
  confirm?: string;
}

const BULK_ACTIONS: BulkAction[] = [
  { key: "sendEmail", label: "Send Email", icon: Mail, tone: "default" },
  { key: "adjustPoints", label: "Adjust Points", icon: Coins, tone: "default" },
  { key: "changeTier", label: "Change Tier", icon: Crown, tone: "default" },
  {
    key: "banSelected",
    label: "Ban Selected",
    icon: Ban,
    tone: "danger",
    confirm: "Ban {N} selected users? This will block them from logging in.",
  },
  {
    key: "deleteSelected",
    label: "Delete Selected",
    icon: Trash2,
    tone: "danger",
    confirm:
      "Soft-delete {N} selected users? They'll be marked deleted and banned.",
  },
];

export function BulkActionsBar({
  selectedIds,
  onClear,
  handlers,
}: BulkActionsBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (selectedIds.length === 0) return null;

  const runAction = async (action: BulkAction) => {
    const handler = handlers[action.key];
    if (!handler) return;
    if (action.confirm) {
      const msg = action.confirm.replace("{N}", String(selectedIds.length));
      if (!(await confirmDialog({ title: "Please confirm", description: msg, tone: "info" }))) return;
    }
    setBusy(true);
    try {
      await handler(selectedIds);
    } finally {
      setBusy(false);
      setIsMenuOpen(false);
    }
  };

  const availableActions = BULK_ACTIONS.filter((a) => handlers[a.key]);

  return (
    <div className="sticky top-16 z-20 -mx-2 sm:-mx-4 px-3 sm:px-5 py-3 bg-blue-500/10 backdrop-blur-md border-y border-blue-500/30 flex items-center gap-3 flex-wrap">
      <button
        onClick={onClear}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
      <span className="text-sm text-white font-medium">
        {selectedIds.length} selected
      </span>

      <div className="flex-1" />

      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={busy}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Bulk Actions
          <ChevronDown className="w-4 h-4" />
        </button>
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-40 py-1">
              {availableActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    onClick={() => runAction(action)}
                    disabled={busy}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 text-sm text-left",
                      action.tone === "danger"
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                      "disabled:opacity-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
