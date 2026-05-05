/**
 * Location reference data helpers.
 *
 * The User schema stores address fields as flat strings (country, region,
 * division, subDivision, district, subDistrict, city, village, postalCode).
 * The Country + Location tables are reference data driving cascading
 * dropdowns; they do NOT replace the User fields.
 *
 * Hierarchy (top → bottom): STATE / REGION / DIVISION → SUB_DIVISION →
 * DISTRICT → SUB_DISTRICT → CITY → VILLAGE. Different countries use
 * different subsets — the country's `enabledLevels` array decides which
 * dropdowns render. Levels not in `enabledLevels` (or with no DB data) fall
 * back to free-text inputs so flows are never blocked.
 */

export type LocationType =
  | "STATE"
  | "REGION"
  | "DIVISION"
  | "SUB_DIVISION"
  | "DISTRICT"
  | "SUB_DISTRICT"
  | "CITY"
  | "VILLAGE";

export const ALL_LOCATION_TYPES: LocationType[] = [
  "STATE",
  "REGION",
  "DIVISION",
  "SUB_DIVISION",
  "DISTRICT",
  "SUB_DISTRICT",
  "CITY",
  "VILLAGE",
];

/** Top-to-bottom rendering order. */
export const LEVEL_ORDER: LocationType[] = [
  "STATE",
  "REGION",
  "DIVISION",
  "SUB_DIVISION",
  "DISTRICT",
  "SUB_DISTRICT",
  "CITY",
  "VILLAGE",
];

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  STATE: "State",
  REGION: "Region",
  DIVISION: "Division",
  SUB_DIVISION: "Sub Division",
  DISTRICT: "District",
  SUB_DISTRICT: "Sub District / Thana",
  CITY: "City",
  VILLAGE: "Village",
};

/** Map a User schema field name → its LocationType, for the LocationSelector binding. */
export const FIELD_TO_TYPE: Record<string, LocationType> = {
  region: "REGION",
  division: "DIVISION",
  subDivision: "SUB_DIVISION",
  district: "DISTRICT",
  subDistrict: "SUB_DISTRICT",
  city: "CITY",
  village: "VILLAGE",
};

/** Inverse of FIELD_TO_TYPE — locate the User field name for a given level. */
export const TYPE_TO_FIELD: Partial<Record<LocationType, string>> = {
  REGION: "region",
  DIVISION: "division",
  SUB_DIVISION: "subDivision",
  DISTRICT: "district",
  SUB_DISTRICT: "subDistrict",
  CITY: "city",
  VILLAGE: "village",
};

/** STATE shares the same User-side field as REGION (region) when used. */
export function fieldForType(t: LocationType): string | undefined {
  if (t === "STATE") return "region";
  return TYPE_TO_FIELD[t];
}

/**
 * Filter LEVEL_ORDER to only the types listed in enabledLevels, preserving
 * top-to-bottom order. Used by the frontend to know which dropdowns to render.
 */
export function activeLevels(enabledLevels: string[]): LocationType[] {
  const set = new Set(enabledLevels.filter(isLocationType));
  return LEVEL_ORDER.filter((t) => set.has(t));
}

export function isLocationType(s: string): s is LocationType {
  return (ALL_LOCATION_TYPES as string[]).includes(s);
}
