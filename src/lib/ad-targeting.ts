// Client-safe ad-targeting types + a pure matcher. NO server imports here so
// the advertiser/admin ad forms (client components) can reuse the type + parser.
// The feed serve endpoint uses `matchesTargeting` to decide who sees an ad.

/** Simple audience rules stored on Ad.targeting (JSON). All present rules must
 *  match (AND). An empty/missing rule = no constraint on that dimension. */
export interface AdTargeting {
  countries?: string[]; // matches User.country (case-insensitive)
  genders?: string[]; // matches User.gender (e.g. MALE/FEMALE/OTHER)
  minLevel?: number; // User.level must be >= this
  packages?: string[]; // package slugs the viewer's plan must be one of
}

/** The viewer attributes we target on. */
export interface TargetableUser {
  country?: string | null;
  gender?: string | null;
  level?: number | null;
  packageSlug?: string | null;
}

/** Safely read a stored `targeting` JSON into a typed object. Unknown/invalid
 *  shapes collapse to an empty (target-everyone) targeting. */
export function parseTargeting(v: unknown): AdTargeting {
  if (!v || typeof v !== "object") return {};
  const src = v as Record<string, unknown>;
  const out: AdTargeting = {};
  if (Array.isArray(src.countries)) {
    out.countries = src.countries.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(src.genders)) {
    out.genders = src.genders.filter((x): x is string => typeof x === "string");
  }
  if (typeof src.minLevel === "number" && src.minLevel > 0) {
    out.minLevel = src.minLevel;
  }
  if (Array.isArray(src.packages)) {
    out.packages = src.packages.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** Normalize a targeting object to null when it has no active rules (so we can
 *  store `null` for "everyone" instead of an empty object). */
export function normalizeTargeting(t: AdTargeting): AdTargeting | null {
  const hasRule =
    (t.countries && t.countries.length > 0) ||
    (t.genders && t.genders.length > 0) ||
    (typeof t.minLevel === "number" && t.minLevel > 0) ||
    (t.packages && t.packages.length > 0);
  return hasRule ? t : null;
}

/** True if the viewer satisfies every set targeting rule. A null/empty
 *  targeting matches everyone. */
export function matchesTargeting(
  targeting: unknown,
  user: TargetableUser
): boolean {
  const t = parseTargeting(targeting);

  if (t.countries && t.countries.length > 0) {
    const c = (user.country ?? "").toLowerCase();
    if (!t.countries.some((x) => x.toLowerCase() === c)) return false;
  }
  if (t.genders && t.genders.length > 0) {
    const g = (user.gender ?? "").toUpperCase();
    if (!t.genders.some((x) => x.toUpperCase() === g)) return false;
  }
  if (typeof t.minLevel === "number" && t.minLevel > 0) {
    if ((user.level ?? 0) < t.minLevel) return false;
  }
  if (t.packages && t.packages.length > 0) {
    const p = user.packageSlug ?? "";
    if (!t.packages.includes(p)) return false;
  }
  return true;
}
