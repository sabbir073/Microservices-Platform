import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/** Find a unique slug for an Offer, appending -2, -3, … on collision. */
export async function ensureUniqueOfferSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const root = (slugify(base) || "offer").slice(0, 80);
  let candidate = root;
  let n = 1;
  for (;;) {
    const clash = await prisma.offer.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`.slice(0, 80);
    if (n > 50) return `${root}-${Date.now().toString(36)}`;
  }
}
