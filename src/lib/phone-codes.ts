/**
 * Country ISO2 → international dialing code map.
 *
 * Used by exporters / forms to normalize phone numbers like
 * Bangladeshi `01734410309` into international `+8801734410309` so
 * country-wise filtering works in Excel and so leading zeros aren't
 * dropped by spreadsheet tools.
 */
export const PHONE_CODES: Record<string, string> = {
  BD: "+880",
  IN: "+91",
  PK: "+92",
  US: "+1",
  CA: "+1",
  UK: "+44",
  GB: "+44",
  AU: "+61",
  AE: "+971",
  SA: "+966",
  MY: "+60",
  SG: "+65",
  ID: "+62",
  PH: "+63",
  NG: "+234",
  EG: "+20",
  CN: "+86",
  JP: "+81",
  KR: "+82",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  BR: "+55",
  MX: "+52",
  RU: "+7",
  TR: "+90",
  ZA: "+27",
  KE: "+254",
  NP: "+977",
  LK: "+94",
  MM: "+95",
  TH: "+66",
  VN: "+84",
  IR: "+98",
  IQ: "+964",
  QA: "+974",
  KW: "+965",
  OM: "+968",
  BH: "+973",
  JO: "+962",
  LB: "+961",
  PT: "+351",
  NL: "+31",
  BE: "+32",
  CH: "+41",
  AT: "+43",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  FI: "+358",
  PL: "+48",
  RO: "+40",
  GR: "+30",
  IE: "+353",
  NZ: "+64",
};

/** Look up the international dialing code for a country.
 *  Returns `null` if the country is unknown. */
export function getPhoneCode(countryIso2: string | null | undefined): string | null {
  if (!countryIso2) return null;
  return PHONE_CODES[countryIso2.toUpperCase()] ?? null;
}

/**
 * Format a phone number as international (e.g. `+8801734410309`) so it
 * survives Excel without losing leading zeros and is filterable by code.
 *
 * - If `phone` already starts with `+`, returned as-is (assumed canonical).
 * - If we know the country code, strip any leading `0` and prepend the dial code.
 * - Otherwise return the raw phone unchanged (still wrapped safely upstream).
 */
export function formatInternationalPhone(
  phone: string | null | undefined,
  countryIso2: string | null | undefined
): string {
  if (!phone) return "";
  const trimmed = phone.replace(/\s+/g, "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;

  const code = getPhoneCode(countryIso2);
  if (!code) return trimmed;

  // Drop one leading 0 (common Bangladesh-style local prefix), then prepend.
  const local = trimmed.startsWith("0") ? trimmed.slice(1) : trimmed;
  return `${code}${local}`;
}
