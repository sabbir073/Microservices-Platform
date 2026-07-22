import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra classes for the th/td (e.g. "text-right", "w-10"). */
  className?: string;
  /** Omit this column from the stacked mobile card. */
  mobileHidden?: boolean;
  /** Use this column's cell as the mobile card's title block. */
  primary?: boolean;
}

interface AdminTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Rendered instead of the table when there are no rows. */
  empty?: ReactNode;
  className?: string;
  /** Omit the outer glass surface (when embedding inside an existing card). */
  bare?: boolean;
}

/**
 * Responsive admin table. Renders a real `<table>` from `md` up and reflows to
 * stacked glass cards below `md` (label:value pairs), so admin list pages are
 * usable on phones instead of only horizontally scrolling. Cells are render
 * props, so badges/avatars/action menus keep working unchanged.
 */
export function AdminTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className,
  bare,
}: AdminTableProps<T>) {
  if (!rows.length && empty !== undefined) return <>{empty}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const mobileCols = columns.filter((c) => c !== primary && !c.mobileHidden);

  return (
    <div
      className={cn(!bare && "glass overflow-hidden", className)}
    >
      {/* Desktop / tablet table */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-800/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="hover:bg-slate-800/30 transition-colors"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn("py-3.5 px-5 text-sm text-slate-200", c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-800">
        {rows.map((row) => (
          <div key={getRowKey(row)} className="p-4 space-y-2.5">
            <div className="min-w-0">{primary.cell(row)}</div>
            {mobileCols.length > 0 && (
              <dl className="space-y-1.5">
                {mobileCols.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <dt className="text-xs text-slate-500 shrink-0 pt-0.5">
                      {c.header}
                    </dt>
                    <dd className="text-sm text-slate-200 text-right min-w-0">
                      {c.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
