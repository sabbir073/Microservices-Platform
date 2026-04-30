"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface FilterChip {
  /** Search-param key this chip controls (used to remove it). */
  key: string;
  /** Optional second key removed alongside (e.g. min/max range pair). */
  pairKey?: string;
  label: string;
  value: string;
}

interface ActiveFilterChipsProps {
  chips: FilterChip[];
  /** When all chips removed, whether to also remove ?page=. */
  resetPage?: boolean;
}

export function ActiveFilterChips({
  chips,
  resetPage = true,
}: ActiveFilterChipsProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();

  if (chips.length === 0) return null;

  const removeChip = (chip: FilterChip) => {
    const next = new URLSearchParams(sp.toString());
    next.delete(chip.key);
    if (chip.pairKey) next.delete(chip.pairKey);
    if (resetPage) next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Filters:</span>
      {chips.map((chip) => (
        <button
          key={`${chip.key}-${chip.value}`}
          onClick={() => removeChip(chip)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs hover:bg-blue-500/25 transition-colors"
        >
          <span className="font-medium">{chip.label}:</span>
          <span>{chip.value}</span>
          <X className="w-3 h-3" />
        </button>
      ))}
      <Link
        href={pathname}
        className="text-xs text-slate-400 hover:text-white underline-offset-2 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}
