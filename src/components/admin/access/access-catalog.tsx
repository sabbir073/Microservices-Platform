"use client";

import { useMemo, useState } from "react";
import { Search, Shield, UserCircle2, AlertTriangle } from "lucide-react";

/**
 * The searchable reference half of the unified access page.
 *
 * It spans TWO systems that are deliberately not merged:
 *
 *   STAFF ACCESS  — RBAC permissions. What an employee may do inside the admin
 *                   panel. Enforced by `can()` on ~166 admin API routes.
 *   CUSTOMER      — package features. What a customer may do on the user-facing
 *   CAPABILITIES    side. Enforced by `getEffectiveFeatures()`.
 *
 * They are shown side by side because the owner wanted one place to look, and
 * banded in two clearly different colours because granting the wrong one is the
 * actual, repeated mistake — see the warning callout on the feature band.
 */

type Row = { key: string; label: string; description: string; group: string };

interface Props {
  permissions: Row[];
  features: Row[];
}

export function AccessCatalog({ permissions, features }: Props) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<"all" | "staff" | "client">("all");

  const needle = q.trim().toLowerCase();

  const filter = (rows: Row[]) =>
    needle
      ? rows.filter(
          (r) =>
            r.key.toLowerCase().includes(needle) ||
            r.label.toLowerCase().includes(needle) ||
            r.description.toLowerCase().includes(needle) ||
            r.group.toLowerCase().includes(needle)
        )
      : rows;

  const shownPerms = useMemo(
    () => (band === "client" ? [] : filter(permissions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle, band, permissions]
  );
  const shownFeatures = useMemo(
    () => (band === "staff" ? [] : filter(features)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle, band, features]
  );

  const groupOf = (rows: Row[]) => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const list = map.get(r.group);
      if (list) list.push(r);
      else map.set(r.group, [r]);
    }
    return Array.from(map.entries());
  };

  return (
    <div className="space-y-5">
      {/* Search + band filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all permissions and features — try “withdraw”, “ads”, “ban”…"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden shrink-0">
          {(
            [
              ["all", "Everything"],
              ["staff", "Staff access"],
              ["client", "Customer features"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBand(id)}
              className={`px-3 py-2.5 text-sm transition-colors ${
                band === id
                  ? "bg-slate-700 text-white"
                  : "bg-slate-950 text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {needle && shownPerms.length === 0 && shownFeatures.length === 0 && (
        <p className="text-sm text-slate-500 py-8 text-center">
          Nothing matches “{q}”.
        </p>
      )}

      {/* ── Staff access band ── */}
      {shownPerms.length > 0 && (
        <section className="rounded-xl border border-violet-500/30 bg-violet-500/[0.04] overflow-hidden">
          <header className="px-4 py-3 border-b border-violet-500/20 flex items-start gap-3">
            <Shield className="w-5 h-5 text-violet-300 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Staff access — admin panel permissions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Changing these changes what an EMPLOYEE can do inside the admin
                panel. Assign them by editing a role below, or per person on a
                staff account. {shownPerms.length} shown.
              </p>
            </div>
          </header>
          <div className="divide-y divide-slate-800/60">
            {groupOf(shownPerms).map(([group, rows]) => (
              <div key={group} className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-violet-300/70 font-medium mb-2">
                  {group}
                </p>
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.key} className="flex flex-col sm:flex-row sm:gap-4">
                      <div className="sm:w-72 shrink-0">
                        <p className="text-sm text-white">{r.label}</p>
                        <code className="text-[11px] text-slate-500">{r.key}</code>
                      </div>
                      <p className="text-sm text-slate-400 flex-1">
                        {r.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Customer capability band ── */}
      {shownFeatures.length > 0 && (
        <section className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] overflow-hidden">
          <header className="px-4 py-3 border-b border-sky-500/20 flex items-start gap-3">
            <UserCircle2 className="w-5 h-5 text-sky-300 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Customer capabilities — user-facing features
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Changing these changes what a CLIENT can do in the app. They come
                from the customer&apos;s package and can be granted or denied per
                person on their user record. They give no admin-panel access at
                all. {shownFeatures.length} shown.
              </p>
            </div>
          </header>

          <div className="mx-4 my-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-200">
                The mistake this page invites.
              </strong>{" "}
              A customer asks to run ads. The right grant is the{" "}
              <strong>Run Ads (advertiser)</strong> feature in this band — their
              own campaigns, their own money, their own stats. It is{" "}
              <em>not</em> the <strong>Ad Manager</strong> role in the band
              above: that is a staff role carrying{" "}
              <code className="text-amber-300">ads.manage</code> over{" "}
              <strong>every</strong> advertiser&apos;s campaigns, so giving it to
              a buyer hands them everyone else&apos;s ad account. Same word, two
              systems, very different blast radius.
            </p>
          </div>

          <div className="divide-y divide-slate-800/60">
            {groupOf(shownFeatures).map(([group, rows]) => (
              <div key={group} className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-sky-300/70 font-medium mb-2">
                  {group}
                </p>
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.key} className="flex flex-col sm:flex-row sm:gap-4">
                      <div className="sm:w-72 shrink-0">
                        <p className="text-sm text-white">{r.label}</p>
                        <code className="text-[11px] text-slate-500">{r.key}</code>
                      </div>
                      <p className="text-sm text-slate-400 flex-1">
                        {r.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
