import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Premium glass wrapper for admin tables we haven't reflowed to cards. Gives a
 * consistent frosted container + a clean thin-scrollbar horizontal scroll on
 * narrow screens (replaces the ad-hoc `bg-slate-900 rounded-xl border …
 * overflow-x-auto` blocks). Wrap the raw `<table>` directly:
 *
 *   <AdminTableShell>
 *     <table className="w-full min-w-[720px]"> … </table>
 *   </AdminTableShell>
 */
export function AdminTableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass overflow-hidden", className)}>
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
    </div>
  );
}
