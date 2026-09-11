import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * The server-side half of the ONE canonical country list.
 *
 * `src/lib/use-countries.ts` is the client half: it fetches `Country` over
 * `/api/locations/countries` so every dropdown offers the same 196 rows. This is
 * the same table, read directly, for the code paths that have to *interpret* a
 * country value rather than offer a choice.
 *
 * ## Why this exists
 *
 * `User.country` is documented as ISO-3166-1 alpha-2 and every consumer assumes
 * it: `matchesTargeting()` compares it to a list of ISO2 codes, `audience.ts`
 * filters on it, `ad-geo.ts` refuses anything that is not two letters. But the
 * admin user editor shipped a FREE-TEXT country box with the placeholder
 * "Bangladesh", so three live accounts hold the literal string `"Bangladesh"`.
 *
 * The damage is silent, which is the worst kind: those users are not shown an
 * error, they are simply never matched by a Bangladesh-targeted campaign and
 * they fall into the `ZZ` unknown bucket in every report. Nobody would ever see
 * a symptom — the ads just quietly reach fewer people than the advertiser paid
 * for.
 *
 * Fixing the write sites (done — see the callers of `resolveCountryCode`) stops
 * NEW bad values. This module is the other half: it makes READS tolerant, so a
 * row that is already wrong, or one that arrives from a future import or a
 * partner API, resolves instead of vanishing.
 *
 * ## Why it is cached at module level
 *
 * `matchesTargeting` runs per ad per viewer on the serve path. A country lookup
 * that cost a query there would add one round-trip per ad per impression to the
 * hottest path in the system, to answer a question about 196 rows that change
 * roughly never. So the whole table is loaded once per instance and held for an
 * hour; `Country` is reference data that the admin edits by hand.
 */

export interface CountryDetail {
  /** ISO-3166-1 alpha-2, uppercase. */
  code: string;
  name: string;
  flag: string | null;
  iso3: string | null;
}

interface CountryIndex {
  /** ISO2 → detail. */
  byCode: Map<string, CountryDetail>;
  /**
   * Every spelling that should resolve to an ISO2 — lowercased name, iso3, and
   * the code itself. One map rather than three so a lookup is one probe.
   */
  alias: Map<string, string>;
}

const TTL_MS = 60 * 60_000;
const EMPTY: CountryIndex = { byCode: new Map(), alias: new Map() };

let index: CountryIndex = EMPTY;
let loadedAt = 0;
let inflight: Promise<CountryIndex> | null = null;

/**
 * Load (or refresh) the index. Never throws: a country lookup that fails must
 * degrade to "leave the value alone", never break an ad serve or a profile save.
 */
export async function loadCountryIndex(): Promise<CountryIndex> {
  if (index !== EMPTY && Date.now() - loadedAt < TTL_MS) return index;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rows = (await prisma.country.findMany({
        select: { iso2: true, iso3: true, name: true, flag: true },
        // Reference data behind a per-instance cache already — the Accelerate
        // TTL only matters for the first read of a cold instance.
        cacheStrategy: { ttl: 300, swr: 3600 },
      })) as unknown as {
        iso2: string;
        iso3: string | null;
        name: string;
        flag: string | null;
      }[];
      const byCode = new Map<string, CountryDetail>();
      const alias = new Map<string, string>();
      for (const r of rows) {
        const code = (r.iso2 ?? "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) continue;
        const detail: CountryDetail = {
          code,
          name: r.name,
          flag: r.flag ?? null,
          iso3: r.iso3 ? r.iso3.toUpperCase() : null,
        };
        byCode.set(code, detail);
        alias.set(code.toLowerCase(), code);
        if (detail.iso3) alias.set(detail.iso3.toLowerCase(), code);
        if (r.name) alias.set(r.name.trim().toLowerCase(), code);
      }
      // An empty read (table not seeded, DB blip) must NOT be cached as the
      // answer — that would turn a transient failure into an hour of every
      // country being unresolvable.
      if (byCode.size > 0) {
        index = { byCode, alias };
        loadedAt = Date.now();
      }
      return index;
    } catch {
      return index;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Test/admin hook — drop the cache so the next read re-queries. */
export function clearCountryIndexCache(): void {
  index = EMPTY;
  loadedAt = 0;
}

/**
 * Resolve anything a form, an import or an old row might hold into an ISO2 code.
 *
 * Accepts: an ISO2 code in any case, an ISO3 code, or the country's full name
 * (case- and whitespace-insensitive). Returns `null` when it cannot be resolved
 * — the caller decides whether that means "reject the write" or "store nothing",
 * because those are different answers and this must not pick for them.
 */
export async function resolveCountryCode(
  raw: string | null | undefined
): Promise<string | null> {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // Fast path: already a plausible ISO2. Still checked against the table so a
  // typo like "XZ" does not sail through as if it were a country.
  const idx = await loadCountryIndex();
  const hit = idx.alias.get(v.toLowerCase());
  if (hit) return hit;
  // The table could not answer (cold DB, unseeded). A well-formed ISO2 is
  // better preserved than discarded.
  if (idx.byCode.size === 0 && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return null;
}

/**
 * Synchronous variant for hot paths that cannot await (the targeting matcher).
 *
 * Returns the resolved ISO2 when the index is already warm, and otherwise the
 * input uppercased — i.e. exactly the previous behaviour. It NEVER triggers a
 * load, because a sync function cannot wait for one; callers on an async path
 * should `await loadCountryIndex()` once before the loop (`ad-serve` does).
 */
export function resolveCountryCodeSync(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  return index.alias.get(v.toLowerCase()) ?? v.toUpperCase();
}

/** Full detail for a stored code, or null when it is not a known country. */
export async function countryDetail(
  code: string | null | undefined
): Promise<CountryDetail | null> {
  const idx = await loadCountryIndex();
  return idx.byCode.get((code ?? "").trim().toUpperCase()) ?? null;
}

/**
 * Every ISO2 → detail, for surfaces that label a whole column of codes at once
 * (the admin country breakdown). One index read, not one lookup per row.
 */
export async function countryDetailMap(): Promise<Map<string, CountryDetail>> {
  const idx = await loadCountryIndex();
  return idx.byCode;
}

/**
 * Expand a targeting list of ISO2 codes into every spelling a `User.country`
 * row might legitimately hold, for SQL `in` filters that cannot call a resolver
 * per row (`audience.ts`). "BD" becomes `["BD", "BGD", "Bangladesh"]`, matched
 * case-insensitively, so the three accounts holding the literal name are
 * included in the segment their country was chosen for.
 */
export async function countryMatchAliases(codes: string[]): Promise<string[]> {
  const idx = await loadCountryIndex();
  const out = new Set<string>();
  for (const raw of codes) {
    const code = (raw ?? "").trim().toUpperCase();
    if (!code) continue;
    out.add(code);
    const d = idx.byCode.get(code);
    if (d) {
      if (d.iso3) out.add(d.iso3);
      if (d.name) out.add(d.name);
    }
  }
  return [...out];
}
