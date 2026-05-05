/**
 * Follower-boost filter shared between admin preview/apply endpoints and the
 * audit log. The filter selects which users will be auto-set as followers of
 * a given target.
 *
 * The filter set is intentionally lean (curated for ad-targeting at scale).
 * If admin needs finer slicing (district / nationality / etc.) they can rerun
 * with different combinations of country + city + level + age + tier.
 */
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const MAX_PER_OPERATION = 10000;

export const filterSchema = z.object({
  gender: z.string().min(1).max(40).optional(),
  country: z.string().min(1).max(80).optional(),
  city: z.string().min(1).max(80).optional(),
  packageTier: z
    .enum(["FREE", "STARTER", "PRO", "ELITE", "VIP"])
    .optional(),
  isBlueVerified: z.boolean().optional(),
  levelMin: z.number().int().min(1).max(100).optional(),
  levelMax: z.number().int().min(1).max(100).optional(),
  ageMin: z.number().int().min(1).max(120).optional(),
  ageMax: z.number().int().min(1).max(120).optional(),
  excludeAdmins: z.boolean().optional().default(true),
});

export type FollowerBoostFilter = z.infer<typeof filterSchema>;

/**
 * Apply input — admin specifies exactly how many followers to add. Selection
 * from the matching pool is always random (fairness). To add "all matching",
 * the UI fills `amount` with the matching count for the user.
 *
 * `mode` is accepted for backward compatibility with old saved batches but is
 * ignored — the apply endpoint always uses random selection capped at the
 * provided amount.
 */
export const applySchema = z.object({
  filter: filterSchema,
  amount: z.number().int().min(1).max(MAX_PER_OPERATION),
  notifyTarget: z.boolean().default(false),
  mode: z.enum(["ALL", "RANDOM"]).optional(),
});

export type ApplyInput = z.infer<typeof applySchema>;

/**
 * Build the Prisma where clause from a filter. Always restricts to ACTIVE
 * users and (by default) excludes admin roles. Excludes the target itself
 * and anyone already following the target.
 */
export function buildWhere(
  f: FollowerBoostFilter,
  targetId: string,
  excludeUserIds: string[]
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    AND: [{ id: { not: targetId } }],
    status: "ACTIVE",
  };
  const andClauses = where.AND as Prisma.UserWhereInput[];

  if (excludeUserIds.length > 0) {
    andClauses.push({ id: { notIn: excludeUserIds } });
  }
  if (f.gender) {
    andClauses.push({
      gender: { equals: f.gender, mode: "insensitive" },
    });
  }
  if (f.country) {
    andClauses.push({
      country: { equals: f.country, mode: "insensitive" },
    });
  }
  if (f.city) {
    andClauses.push({
      city: { equals: f.city, mode: "insensitive" },
    });
  }
  if (f.packageTier) {
    andClauses.push({ packageTier: f.packageTier });
  }
  if (typeof f.isBlueVerified === "boolean") {
    andClauses.push({ isBlueVerified: f.isBlueVerified });
  }
  if (typeof f.levelMin === "number") {
    andClauses.push({ level: { gte: f.levelMin } });
  }
  if (typeof f.levelMax === "number") {
    andClauses.push({ level: { lte: f.levelMax } });
  }

  // Age range → dateOfBirth window. ageMin / ageMax are inclusive.
  // Someone who is exactly N years old has a DOB in the window
  //   (now - (N+1) years, now - N years]
  if (typeof f.ageMin === "number" || typeof f.ageMax === "number") {
    const now = new Date();
    if (typeof f.ageMax === "number") {
      const minDob = new Date(now);
      minDob.setUTCFullYear(now.getUTCFullYear() - f.ageMax - 1);
      andClauses.push({ dateOfBirth: { gte: minDob } });
    }
    if (typeof f.ageMin === "number") {
      const maxDob = new Date(now);
      maxDob.setUTCFullYear(now.getUTCFullYear() - f.ageMin);
      andClauses.push({ dateOfBirth: { lte: maxDob } });
    }
    // Exclude users without a DOB (they can't satisfy an age constraint)
    andClauses.push({ dateOfBirth: { not: null } });
  }

  if (f.excludeAdmins !== false) {
    andClauses.push({ role: "USER" });
  }
  return where;
}
