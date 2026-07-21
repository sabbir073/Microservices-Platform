"use client";

import { useSyncExternalStore, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Gift,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribeNotify,
  getNotifySnapshot,
  dismissNotify,
  type NotifyItem,
  type NotifyKind,
} from "@/lib/notify-center";

const TONE: Record<
  Exclude<NotifyKind, "reward">,
  { icon: typeof Info; accent: string; ring: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-400",
    ring: "bg-emerald-500/10 ring-1 ring-emerald-500/25",
  },
  error: {
    icon: XCircle,
    accent: "text-red-400",
    ring: "bg-red-500/10 ring-1 ring-red-500/25",
  },
  warning: {
    icon: AlertTriangle,
    accent: "text-amber-400",
    ring: "bg-amber-500/10 ring-1 ring-amber-500/25",
  },
  info: {
    icon: Info,
    accent: "text-indigo-400",
    ring: "bg-indigo-500/10 ring-1 ring-indigo-500/25",
  },
};

export function NotifyCenterHost() {
  const active = useSyncExternalStore(
    subscribeNotify,
    getNotifySnapshot,
    () => null
  );

  // `active` is null on the server + first client render, so createPortal /
  // document is only reached after a notification is triggered (client only).
  if (!active) return null;
  return createPortal(
    <NotifyView key={active.id} item={active} />,
    document.body
  );
}

function formatAmount(amount: number, unit: "pts" | "USD") {
  return unit === "pts"
    ? `+${amount.toLocaleString()} pts`
    : `+$${amount.toFixed(2)}`;
}

function NotifyView({ item }: { item: NotifyItem }) {
  const { id, durationMs } = item;

  // Auto-dismiss after the item's duration.
  useEffect(() => {
    const t = setTimeout(() => dismissNotify(id), durationMs);
    return () => clearTimeout(t);
  }, [id, durationMs]);

  const close = () => dismissNotify(id);

  return (
    <div
      className="fixed inset-0 z-10001 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {item.kind === "reward" ? (
        <RewardCard item={item} onClose={close} />
      ) : (
        <SimpleCard item={item} onClose={close} />
      )}
    </div>
  );
}

function RewardCard({
  item,
  onClose,
}: {
  item: NotifyItem;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
      className="relative w-full max-w-xs cursor-pointer rounded-3xl border border-amber-500/25 bg-linear-to-b from-gray-900 to-gray-950 px-6 pt-8 pb-7 text-center shadow-2xl shadow-amber-500/10 animate-pop-in"
    >
      {/* Sparkle burst */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        {[
          "left-6 top-6",
          "right-7 top-8",
          "left-10 bottom-8",
          "right-9 bottom-10",
          "left-1/2 top-4",
        ].map((pos, i) => (
          <Sparkles
            key={i}
            className={cn(
              "absolute h-4 w-4 text-amber-300/80 animate-sparkle",
              pos
            )}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>

      {/* Gift medallion */}
      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-linear-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30 animate-pop-in">
        <Gift className="h-10 w-10 text-white" />
      </div>

      {typeof item.amount === "number" && (
        <p className="bg-linear-to-r from-amber-300 to-orange-400 bg-clip-text text-4xl font-black tabular-nums text-transparent">
          {formatAmount(item.amount, item.unit ?? "pts")}
        </p>
      )}
      <h2 className="mt-1 text-lg font-bold text-white">{item.title}</h2>
      {item.description && (
        <p className="mt-1 text-sm text-gray-400">{item.description}</p>
      )}
      <p className="mt-4 text-[11px] uppercase tracking-wider text-gray-600">
        Tap to dismiss
      </p>
    </div>
  );
}

function SimpleCard({
  item,
  onClose,
}: {
  item: NotifyItem;
  onClose: () => void;
}) {
  const tone = TONE[item.kind as Exclude<NotifyKind, "reward">] ?? TONE.info;
  const Icon = tone.icon;
  return (
    <div
      role="status"
      onMouseDown={(e) => e.stopPropagation()}
      className="relative w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-2xl animate-pop-in"
    >
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-lg p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
            tone.ring
          )}
        >
          <Icon className={cn("h-6 w-6", tone.accent)} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-base font-bold text-white">{item.title}</h2>
          {item.description && (
            <p className="mt-1 text-sm text-gray-400 whitespace-pre-line">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
