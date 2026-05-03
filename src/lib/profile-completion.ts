/**
 * Profile completion calculator.
 * Returns a percentage + list of missing fields so the UI can show users
 * exactly what's left to fill in.
 */

export interface ProfileSnapshot {
  // Basic
  avatar?: string | null;
  coverPhoto?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | null;
  nidNumber?: string | null;
  // Contact
  emailVerified?: Date | null;
  phone?: string | null;
  phoneVerified?: Date | null;
  // Address
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postalCode?: string | null;
  // Verification
  kycStatus?: string;
  // Other
  tags?: string[] | null;
  socialAccountsCount?: number;
}

export interface CompletionItem {
  key: string;
  label: string;
  category: "basic" | "contact" | "address" | "verification" | "social";
  done: boolean;
  weight: number;
  href?: string;
}

export interface CompletionResult {
  percentage: number;
  totalWeight: number;
  filledWeight: number;
  items: CompletionItem[];
  missing: CompletionItem[];
}

const has = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return v > 0;
  return Boolean(v);
};

export function calculateProfileCompletion(p: ProfileSnapshot): CompletionResult {
  const items: CompletionItem[] = [
    // Basic — heaviest weight (this is what people see first)
    { key: "avatar", label: "Profile photo", category: "basic", weight: 8, done: has(p.avatar), href: "?tab=personal" },
    { key: "coverPhoto", label: "Cover photo", category: "basic", weight: 4, done: has(p.coverPhoto), href: "?tab=personal" },
    { key: "firstName", label: "First name", category: "basic", weight: 5, done: has(p.firstName), href: "?tab=personal" },
    { key: "lastName", label: "Last name", category: "basic", weight: 5, done: has(p.lastName), href: "?tab=personal" },
    { key: "bio", label: "Bio", category: "basic", weight: 6, done: has(p.bio), href: "?tab=personal" },
    { key: "gender", label: "Gender", category: "basic", weight: 3, done: has(p.gender), href: "?tab=personal" },
    { key: "dateOfBirth", label: "Date of birth", category: "basic", weight: 4, done: has(p.dateOfBirth), href: "?tab=personal" },
    { key: "tags", label: "Profile tags", category: "basic", weight: 3, done: (p.tags?.length ?? 0) > 0, href: "?tab=personal" },
    // Contact
    { key: "emailVerified", label: "Verified email", category: "contact", weight: 8, done: has(p.emailVerified), href: "?tab=personal" },
    { key: "phone", label: "Phone number", category: "contact", weight: 5, done: has(p.phone), href: "?tab=personal" },
    { key: "phoneVerified", label: "Verified phone", category: "contact", weight: 6, done: has(p.phoneVerified), href: "?tab=personal" },
    // Address
    { key: "country", label: "Country", category: "address", weight: 5, done: has(p.country), href: "?tab=address" },
    { key: "city", label: "City", category: "address", weight: 3, done: has(p.city), href: "?tab=address" },
    { key: "street", label: "Street address", category: "address", weight: 3, done: has(p.street), href: "?tab=address" },
    { key: "postalCode", label: "Postal code", category: "address", weight: 2, done: has(p.postalCode), href: "?tab=address" },
    // Verification
    { key: "nidNumber", label: "National ID number", category: "verification", weight: 4, done: has(p.nidNumber), href: "?tab=kyc" },
    { key: "kyc", label: "KYC verified", category: "verification", weight: 12, done: p.kycStatus === "APPROVED", href: "?tab=kyc" },
    // Social
    { key: "social", label: "At least 1 social account connected", category: "social", weight: 5, done: (p.socialAccountsCount ?? 0) > 0, href: "?tab=social" },
    { key: "socialThree", label: "3+ social accounts connected", category: "social", weight: 4, done: (p.socialAccountsCount ?? 0) >= 3, href: "?tab=social" },
  ];

  const totalWeight = items.reduce((s, it) => s + it.weight, 0);
  const filledWeight = items.filter((it) => it.done).reduce((s, it) => s + it.weight, 0);
  const percentage = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;

  return {
    percentage,
    totalWeight,
    filledWeight,
    items,
    missing: items.filter((it) => !it.done),
  };
}
