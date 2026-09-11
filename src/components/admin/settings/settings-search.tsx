"use client";

/**
 * Find a setting without knowing which tab it lives on.
 *
 * There are 80-odd controls across eight tabs plus another nine screens that
 * own settings of their own. An admin who remembers the word "withdrawal" was
 * previously expected to remember that it is filed under Financial — and when
 * they could not find it, the conclusion was that the setting did not exist.
 *
 * So this searches the name, the plain-language description AND the raw key,
 * over `admin-settings-catalog.ts` — which covers both the controls on this
 * screen and the ones that live elsewhere in the admin. Picking a result on
 * this screen switches to its tab and scrolls the control into view; picking
 * one that lives elsewhere links out to it.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowRight, ExternalLink } from "lucide-react";
import {
  searchSettings,
  type SettingGroupId,
} from "@/lib/admin-settings-catalog";

export function SettingsSearch({
  onPick,
}: {
  /** Jump to a control on this screen. */
  onPick: (group: SettingGroupId, key: string) => void;
}) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchSettings(q), [q]);
  const shown = hits.slice(0, 12);

  return (
    <div className="border-b border-slate-800 px-4 py-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search every setting — name, what it does, or its key (try “withdrawal”)"
          aria-label="Search settings"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-9 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {q.trim() && (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
          {shown.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">
              Nothing matches “{q}”. Settings that are not on this screen —
              referral rates, package rewards, course refunds — are indexed
              here too, so if it is not found it is most likely not a setting.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/70">
              {shown.map((hit) => {
                const body = (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {hit.label}
                      </span>
                      <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {hit.where}
                      </span>
                      {hit.status === "not-active" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          Not active yet
                        </span>
                      )}
                      {hit.key && (
                        <code className="text-[10px] text-slate-600">
                          {hit.key}
                        </code>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {hit.description}
                    </p>
                  </>
                );

                return (
                  <li key={`${hit.where}:${hit.label}`}>
                    {hit.href ? (
                      <Link
                        href={hit.href}
                        className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-slate-800/50"
                      >
                        <div className="min-w-0">{body}</div>
                        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onPick(hit.group!, hit.key!);
                          setQ("");
                        }}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-800/50"
                      >
                        <div className="min-w-0">{body}</div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-600" />
                      </button>
                    )}
                  </li>
                );
              })}
              {hits.length > shown.length && (
                <li className="px-3 py-2 text-[11px] text-slate-600">
                  +{hits.length - shown.length} more — keep typing to narrow it
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
