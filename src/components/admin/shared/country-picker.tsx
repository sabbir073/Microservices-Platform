"use client";

import { useMemo, useState } from "react";
import { useCountries } from "@/lib/use-countries";

// Reusable country multi-select (chips). Empty selection = all countries.
// Country codes are ISO-2 and match `user.country`. Shared by the offerwall
// offer builder (and available to lift TaskForm's PROXY-only picker onto later).
//
// The list used to be a hardcoded 23 rows in this file — so an offerwall offer
// could only ever be restricted to the 23 countries someone happened to type
// out, on a platform that serves 196. It now reads the canonical `Country`
// table through `useCountries`, the same source as every other country control.
// The old array survives ONLY as the offline fallback for the first paint
// before the fetch lands; it is never the list a user chooses from in practice.

export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "BD", name: "Bangladesh" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "NG", name: "Nigeria" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
];

export function CountryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const all = useCountries(
    COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: null }))
  );
  const [q, setQ] = useState("");

  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  // Selected first, then the search hits. 196 chips is a wall; a chosen country
  // scrolling off the bottom of one is how a mis-set restriction goes unnoticed.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const selected = all.filter((c) => value.includes(c.code));
    const rest = all
      .filter((c) => !value.includes(c.code))
      .filter(
        (c) =>
          !needle ||
          c.code.toLowerCase().includes(needle) ||
          c.name.toLowerCase().includes(needle)
      )
      // Without a search the full list is 196 buttons of noise; show a workable
      // slice and let the box narrow it.
      .slice(0, needle ? 200 : 40);
    return [...selected, ...rest];
  }, [all, value, q]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {value.length === 0 ? "All countries (no restriction)" : `${value.length} selected`}
        </span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-emerald-400 hover:text-emerald-300">
            Clear (all countries)
          </button>
        )}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${all.length} countries…`}
        className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-600"
      />
      <div className="flex flex-wrap gap-1.5">
        {shown.map((c) => {
          const on = value.includes(c.code);
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggle(c.code)}
              title={c.name}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                on ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {c.flag ? `${c.flag} ` : ""}
              {c.code}
            </button>
          );
        })}
        {shown.length === 0 && (
          <span className="text-xs text-slate-600">No country matches “{q}”.</span>
        )}
      </div>
    </div>
  );
}
