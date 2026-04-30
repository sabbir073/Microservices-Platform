"use client";

import { useAdminUI } from "@/lib/stores/admin-ui-store";
import { cn } from "@/lib/utils";

interface AdminLayoutShellProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client-side wrapper that adjusts main content padding based on sidebar collapse state.
 * Server-rendered AdminLayout passes header and children as slots.
 */
export function AdminLayoutShell({ header, children }: AdminLayoutShellProps) {
  const collapsed = useAdminUI((s) => s.sidebarCollapsed);

  return (
    <div
      className={cn(
        "transition-[padding] duration-200",
        collapsed ? "lg:pl-20" : "lg:pl-72"
      )}
    >
      {header}
      <main className="py-6 px-4 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
