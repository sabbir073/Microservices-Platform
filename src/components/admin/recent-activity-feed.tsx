import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export interface ActivityLogEntry {
  id: string;
  action: string;
  entity: string;
  adminName: string | null;
  details: string | null;
  createdAt: Date;
}

interface RecentActivityFeedProps {
  entries: ActivityLogEntry[];
  title?: string;
}

// Tint per entity type so the left-border colour gives a quick visual cue
function entityColor(entity: string): string {
  const e = entity.toLowerCase();
  if (e.includes("user")) return "border-blue-500";
  if (e.includes("withdraw")) return "border-green-500";
  if (e.includes("task") || e.includes("submission")) return "border-purple-500";
  if (e.includes("kyc")) return "border-amber-500";
  if (e.includes("market") || e.includes("dispute")) return "border-pink-500";
  if (e.includes("setting") || e.includes("system")) return "border-slate-500";
  return "border-slate-600";
}

export function RecentActivityFeed({
  entries,
  title = "Recent Activity",
}: RecentActivityFeedProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500">
          Auto-refresh · 30s
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No recent admin activity
        </div>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {entries.map((e) => (
            <li
              key={e.id}
              className={cn(
                "border-l-4 pl-3 py-2 hover:bg-slate-800/40 rounded-r transition-colors",
                entityColor(e.entity)
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-white">{e.action}</p>
                <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                  {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                by {e.adminName || "system"} · <span className="text-slate-500">{e.entity}</span>
              </p>
              {e.details && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {e.details}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
