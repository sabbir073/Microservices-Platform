interface UserGrowthChartProps {
  /** Array of [day-label, count] tuples, oldest first. */
  data: Array<{ label: string; count: number }>;
  title?: string;
}

/**
 * Lightweight inline-SVG bar chart for the dashboard.
 * Avoids adding the recharts dependency in Phase 1.
 * (Phase 5 swaps this for the real recharts version.)
 */
export function UserGrowthChart({
  data,
  title = "User Growth (Last 7 Days)",
}: UserGrowthChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const totalNew = data.reduce((acc, d) => acc + d.count, 0);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            +{totalNew.toLocaleString()} new sign-ups
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs">
          <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400 font-medium">
            Week
          </span>
          <span className="px-2 py-1 rounded text-slate-500">Month</span>
        </div>
      </div>

      <div className="flex items-end gap-2 h-40 pt-4">
        {data.map((d, i) => {
          const heightPct = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-purple-500 transition-[height] duration-500"
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${d.count} users`}
                />
                {d.count > 0 && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-300">
                    {d.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
