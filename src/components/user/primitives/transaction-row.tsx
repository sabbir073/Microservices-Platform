import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Gift,
  ShoppingBag,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export type TxType =
  | "EARN_TASK"
  | "EARN_REFERRAL"
  | "EARN_LOTTERY"
  | "EARN_BONUS"
  | "EARN_OTHER"
  | "WITHDRAWAL"
  | "PURCHASE"
  | "REFUND";

export type TxStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

interface TransactionRowProps {
  type: TxType;
  description: string;
  amount: number;
  unit?: "pts" | "USD";
  status?: TxStatus;
  date: Date | string;
  className?: string;
}

const TYPE_META: Record<TxType, { icon: React.ReactNode; tone: string }> = {
  EARN_TASK: {
    icon: <Coins className="w-4 h-4" />,
    tone: "bg-amber-500/10 text-amber-400",
  },
  EARN_REFERRAL: {
    icon: <Users className="w-4 h-4" />,
    tone: "bg-indigo-500/10 text-indigo-400",
  },
  EARN_LOTTERY: {
    icon: <Trophy className="w-4 h-4" />,
    tone: "bg-purple-500/10 text-purple-400",
  },
  EARN_BONUS: {
    icon: <Sparkles className="w-4 h-4" />,
    tone: "bg-pink-500/10 text-pink-400",
  },
  EARN_OTHER: {
    icon: <Gift className="w-4 h-4" />,
    tone: "bg-emerald-500/10 text-emerald-400",
  },
  WITHDRAWAL: {
    icon: <ArrowUpRight className="w-4 h-4" />,
    tone: "bg-red-500/10 text-red-400",
  },
  PURCHASE: {
    icon: <ShoppingBag className="w-4 h-4" />,
    tone: "bg-orange-500/10 text-orange-400",
  },
  REFUND: {
    icon: <ArrowDownLeft className="w-4 h-4" />,
    tone: "bg-emerald-500/10 text-emerald-400",
  },
};

const STATUS_TONE: Record<TxStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
  CANCELLED: "bg-gray-700 text-gray-400",
};

export function TransactionRow({
  type,
  description,
  amount,
  unit = "pts",
  status,
  date,
  className,
}: TransactionRowProps) {
  const meta = TYPE_META[type];
  const isOutflow = type === "WITHDRAWAL" || type === "PURCHASE";
  const sign = isOutflow ? "-" : "+";
  const absVal = Math.abs(amount);
  const dt = typeof date === "string" ? new Date(date) : date;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 border-b border-gray-800/60 last:border-b-0",
        className
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          meta.tone
        )}
      >
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{description}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-gray-500" title={format(dt, "PPp")}>
            {formatDistanceToNow(dt, { addSuffix: true })}
          </span>
          {status && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                STATUS_TONE[status]
              )}
            >
              {status}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "text-sm font-bold tabular-nums shrink-0",
          isOutflow ? "text-red-400" : "text-emerald-400"
        )}
      >
        {sign}
        {unit === "USD" ? "$" : ""}
        {absVal.toLocaleString()}
        {unit === "pts" && <span className="text-[10px] ml-0.5">pts</span>}
      </div>
    </div>
  );
}
