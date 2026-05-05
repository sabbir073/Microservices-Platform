import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import type { PackageTier } from "@/generated/prisma/client";

interface CountedValue {
  value: string;
  count: number;
}

interface FilterOptions {
  countries: CountedValue[];
  cities: CountedValue[];
  genderCounts: { male: number; female: number; other: number };
  packageTierCounts: Record<PackageTier, number>;
  blueVerifiedCounts: { yes: number; no: number };
  totalActiveUsers: number;
}

/**
 * Pre-aggregate distinct dropdown values from the active-user pool. Cached
 * for 60s — the values change slowly and the form can tolerate 1-min staleness.
 *
 * Cache is keyed only on `"boost-followers:filter-options"` (no per-target
 * key) because the option list itself is target-agnostic — exclusion of a
 * specific target's existing followers happens at preview time, not here.
 */
const computeFilterOptions = unstable_cache(
  async (): Promise<FilterOptions> => {
    const baseWhere = { status: "ACTIVE" as const };

    type CountryGroup = { country: string | null; _count: { country: number } };
    type CityGroup = { city: string | null; _count: { city: number } };

    const [
      countryGroupsRaw,
      cityGroupsRaw,
      maleCount,
      femaleCount,
      otherCount,
      tierFREE,
      tierSTARTER,
      tierPRO,
      tierELITE,
      tierVIP,
      blueYes,
      blueNo,
      total,
    ] = await Promise.all([
      prisma.user.groupBy({
        by: ["country"],
        where: { ...baseWhere, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
        take: 100,
      }),
      prisma.user.groupBy({
        by: ["city"],
        where: { ...baseWhere, city: { not: null } },
        _count: { city: true },
        orderBy: { _count: { city: "desc" } },
        take: 100,
      }),
      prisma.user.count({
        where: { ...baseWhere, gender: { equals: "male", mode: "insensitive" } },
      }),
      prisma.user.count({
        where: {
          ...baseWhere,
          gender: { equals: "female", mode: "insensitive" },
        },
      }),
      prisma.user.count({
        where: {
          ...baseWhere,
          gender: { not: null, notIn: ["male", "Male", "MALE", "female", "Female", "FEMALE"] },
        },
      }),
      prisma.user.count({ where: { ...baseWhere, packageTier: "FREE" } }),
      prisma.user.count({ where: { ...baseWhere, packageTier: "STARTER" } }),
      prisma.user.count({ where: { ...baseWhere, packageTier: "PRO" } }),
      prisma.user.count({ where: { ...baseWhere, packageTier: "ELITE" } }),
      prisma.user.count({ where: { ...baseWhere, packageTier: "VIP" } }),
      prisma.user.count({ where: { ...baseWhere, isBlueVerified: true } }),
      prisma.user.count({ where: { ...baseWhere, isBlueVerified: false } }),
      prisma.user.count({ where: baseWhere }),
    ]);

    const countryGroups = countryGroupsRaw as CountryGroup[];
    const cityGroups = cityGroupsRaw as CityGroup[];

    return {
      countries: countryGroups
        .filter((g) => g.country)
        .map((g) => ({
          value: g.country as string,
          count: g._count.country,
        })),
      cities: cityGroups
        .filter((g) => g.city)
        .map((g) => ({
          value: g.city as string,
          count: g._count.city,
        })),
      genderCounts: {
        male: maleCount,
        female: femaleCount,
        other: otherCount,
      },
      packageTierCounts: {
        FREE: tierFREE,
        STARTER: tierSTARTER,
        PRO: tierPRO,
        ELITE: tierELITE,
        VIP: tierVIP,
      },
      blueVerifiedCounts: { yes: blueYes, no: blueNo },
      totalActiveUsers: total,
    };
  },
  ["boost-followers:filter-options"],
  { revalidate: 60 }
);

// GET /api/admin/users/[id]/boost-followers/filter-options
// Returns the dropdown option lists for the boost-followers filter form.
// The :id segment is not used (options are target-agnostic) but the route
// lives under the user-scoped namespace for permission consistency.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "users.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const options = await computeFilterOptions();
  return NextResponse.json(options);
}
