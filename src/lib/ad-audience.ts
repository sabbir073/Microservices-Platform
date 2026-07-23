import type { Prisma } from "@/generated/prisma/client";
import { KYCStatus } from "@/generated/prisma/client";
import { parseTargeting, type AdTargeting } from "@/lib/ad-targeting";

const KYC_VALUES = new Set(Object.values(KYCStatus) as string[]);

/**
 * Convert an ad `AdTargeting` object into a Prisma `User.where` so we can COUNT
 * how many real platform users an audience reaches. This mirrors
 * `matchesTargeting` (the per-viewer serve-time matcher) as closely as Prisma
 * allows. A few dimensions are approximations at query time:
 *  - packages: filtered on the raw `package.slug` relation (serve uses the
 *    *effective* package, which can differ due to expiry) — close enough for an
 *    estimate.
 *  - age / account-age / active-within: converted to date ranges.
 * The base pool is always ACTIVE users (matches the reach base + serve reality).
 */
export function targetingToUserWhere(
  raw: unknown
): Prisma.UserWhereInput {
  const t: AdTargeting = parseTargeting(raw);
  const now = Date.now();
  const day = 86_400_000;
  const where: Prisma.UserWhereInput = { status: "ACTIVE" };

  if (t.countries?.length) {
    where.country = { in: t.countries, mode: "insensitive" };
  }
  if (t.cities?.length) {
    where.city = { in: t.cities, mode: "insensitive" };
  }
  if (t.genders?.length) {
    where.gender = { in: t.genders, mode: "insensitive" };
  }
  if (t.languages?.length) {
    where.language = { in: t.languages, mode: "insensitive" };
  }
  if (t.kycStatuses?.length) {
    const valid = t.kycStatuses.filter((k) => KYC_VALUES.has(k)) as KYCStatus[];
    if (valid.length) where.kycStatus = { in: valid };
  }
  if (t.verifiedOnly) {
    where.isBlueVerified = true;
  }
  if (t.tags?.length) {
    where.tags = { hasSome: t.tags };
  }
  if (t.packages?.length) {
    where.package = { slug: { in: t.packages } };
  }
  if (t.minLevel || t.maxLevel) {
    where.level = {};
    if (t.minLevel) where.level.gte = t.minLevel;
    if (t.maxLevel) where.level.lte = t.maxLevel;
  }
  // Age → dateOfBirth window. minAge → born on/before (now - minAge years);
  // maxAge → born on/after (now - (maxAge+1) years).
  if (t.minAge || t.maxAge) {
    const dob: Prisma.DateTimeNullableFilter = {};
    const y = (yearsAgo: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - yearsAgo);
      return d;
    };
    if (t.minAge) dob.lte = y(t.minAge);
    if (t.maxAge) dob.gte = y(t.maxAge + 1);
    where.dateOfBirth = dob;
  }
  if (t.minAccountAgeDays) {
    where.createdAt = { lte: new Date(now - t.minAccountAgeDays * day) };
  }
  if (t.activeWithinDays) {
    where.lastLoginAt = { gte: new Date(now - t.activeWithinDays * day) };
  }
  return where;
}
