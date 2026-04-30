"use client";

import { cn } from "@/lib/utils";

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterChip<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  variant?: "pill" | "underline";
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
  variant = "pill",
}: FilterChipsProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto scrollbar-none -mx-4 px-4",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        if (variant === "underline") {
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              )}
            >
              {opt.label}
              {opt.count !== undefined && (
                <span className="ml-1.5 text-xs text-gray-500">
                  {opt.count}
                </span>
              )}
            </button>
          );
        }
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  "px-1.5 rounded-full text-[10px] tabular-nums",
                  active ? "bg-indigo-700" : "bg-gray-900 text-gray-400"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
