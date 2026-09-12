import "server-only";
import { prisma } from "@/lib/prisma";
import { getBuyerSettings } from "@/lib/buyer-settings";
import { BUYER_TASK_TYPES } from "@/lib/buyer-task-types";
import { SOCIAL_PLATFORMS } from "@/lib/social-tasks";

/**
 * What ONE buyer may actually run, right now.
 *
 * Two levels, resolved here so nothing has to remember both:
 *
 *  1. **Global** — the admin's Buyer settings: which task types and which of
 *     the 40 social platforms are open to buyers at all.
 *  2. **Per-buyer** — `User.buyerBlocks`, the exception list for one account.
 *
 * The second is a BLOCK list on purpose. A buyer who keeps posting rubbish on
 * Pinterest should lose Pinterest — not their account, and not everyone else's
 * Pinterest. An allow list would have to be filled in for every buyer before
 * they could do anything, and would quietly freeze them out of any platform
 * added later; a block list defaults to "whatever is currently open", which is
 * what an untouched account should get.
 *
 * Effective = global allowed MINUS this buyer's blocks. Both are checked on the
 * server for every create; the form only ever offers what this returns, so a
 * buyer is never shown an option that will be refused.
 */

export interface BuyerBlocks {
  /** Task types this buyer may not create. */
  types: string[];
  /** Social platform keys this buyer may not target. */
  platforms: string[];
  /** Why — shown to the buyer, so a suspension is never a silent mystery. */
  note: string;
  /** When it was last changed, ISO. */
  at: string | null;
}

export interface BuyerScope {
  /** Task types this buyer may create. */
  types: string[];
  /** Social platform keys this buyer may target. */
  platforms: string[];
  /** Everything the admin has opened to buyers in general. */
  globalTypes: string[];
  globalPlatforms: string[];
  /** This buyer's own suspensions. */
  blocks: BuyerBlocks;
}

/** Every social platform key the catalog knows about. */
export function allPlatformKeys(): string[] {
  return SOCIAL_PLATFORMS.map((p) => p.key);
}

/** Read a stored `buyerBlocks` JSON into a shape nothing has to guess at. */
export function parseBuyerBlocks(v: unknown): BuyerBlocks {
  const src = (v ?? {}) as Record<string, unknown>;
  const list = (x: unknown): string[] =>
    Array.isArray(x)
      ? [...new Set(x.map((s) => String(s).toUpperCase()).filter(Boolean))]
      : [];
  return {
    types: list(src.types),
    platforms: list(src.platforms),
    note: typeof src.note === "string" ? src.note : "",
    at: typeof src.at === "string" ? src.at : null,
  };
}

/**
 * The admin's global list of platforms open to buyers.
 *
 * Unset means ALL of them — a platform added to the catalog later is available
 * without anyone having to remember to tick it. Setting the list narrows it.
 */
export async function globalBuyerPlatforms(): Promise<string[]> {
  const { getSetting } = await import("@/lib/system-settings");
  const raw = await getSetting<unknown>("buyer.allowed_platforms", null);
  const known = new Set(allPlatformKeys());
  if (!Array.isArray(raw)) return allPlatformKeys();
  // Unknown keys are dropped rather than trusted: this decides what a buyer
  // may target, and a typo must not become a platform nothing can verify.
  const picked = raw
    .map((s) => String(s).toUpperCase())
    .filter((k) => known.has(k));
  return picked.length ? [...new Set(picked)] : allPlatformKeys();
}

export async function getBuyerScope(userId: string): Promise<BuyerScope> {
  const [buyer, globalPlatforms, user] = await Promise.all([
    getBuyerSettings(),
    globalBuyerPlatforms(),
    prisma.user.findUnique({
      where: { id: userId },
      select: { buyerBlocks: true },
    }),
  ]);

  const blocks = parseBuyerBlocks(user?.buyerBlocks);
  const blockedTypes = new Set(blocks.types);
  const blockedPlatforms = new Set(blocks.platforms);

  const globalTypes = buyer.allowedTaskTypes.length
    ? buyer.allowedTaskTypes
    : [...BUYER_TASK_TYPES];

  return {
    types: globalTypes.filter((t) => !blockedTypes.has(t)),
    platforms: globalPlatforms.filter((p) => !blockedPlatforms.has(p)),
    globalTypes,
    globalPlatforms,
    blocks,
  };
}

/**
 * Why a buyer cannot use this type, in words they can act on — or null when
 * they can.
 *
 * Separate messages for "nobody can" and "you specifically cannot" because
 * they need different responses: one is the platform's current policy, the
 * other is something the buyer did and may be able to put right.
 */
export function typeRefusal(scope: BuyerScope, type: string): string | null {
  if (scope.types.includes(type)) return null;
  if (scope.blocks.types.includes(type)) {
    return scope.blocks.note
      ? `${type} tasks are suspended on your account: ${scope.blocks.note}`
      : `${type} tasks are suspended on your account. Contact support.`;
  }
  return `${type} tasks aren't open to buyers at the moment.`;
}

/** The same, for a social platform. */
export function platformRefusal(
  scope: BuyerScope,
  platform: string
): string | null {
  const key = platform.toUpperCase();
  if (scope.platforms.includes(key)) return null;
  if (scope.blocks.platforms.includes(key)) {
    return scope.blocks.note
      ? `${key} is suspended on your account: ${scope.blocks.note}`
      : `${key} is suspended on your account. Contact support.`;
  }
  if (!allPlatformKeys().includes(key)) {
    return `${platform} isn't a platform we support.`;
  }
  return `${key} isn't open to buyers at the moment.`;
}
