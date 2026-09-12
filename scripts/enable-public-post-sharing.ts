import "dotenv/config";
import { prisma } from "./_q";

/**
 * Turn logged-out post sharing on, safely.
 *
 * Two rows, written together, because either one alone is wrong:
 *
 *  1. `feed.public_audience_epoch` — the instant the audience picker went live.
 *     `Post.isPublic` DEFAULTS to true and the old composer hardcoded it, so
 *     every post written before this instant says "public" about a choice its
 *     author was never offered. The gate (src/lib/public-post-gate.ts) treats
 *     `isPublic: true` as a real decision ONLY at or after this timestamp.
 *
 *     It is written ONCE and then never moved: re-running this script keeps the
 *     existing epoch. Pushing it forward would un-publish posts people chose to
 *     publish; pulling it back would publish posts nobody chose to. If it ever
 *     genuinely has to change, that is a deliberate edit, not a re-run.
 *
 *  2. `feed.public_post_sharing` — the master switch for the whole logged-out
 *     surface (/post/[id], generateMetadata, the OG image, the sitemap).
 *
 * The epoch is set to NOW, which is only correct if the composer that offers
 * the choice is already deployed. Run this AFTER the deploy, not before: a post
 * made by an old client between the write and the deploy would be counted as a
 * choice it never carried.
 *
 * Dry-run by default. `--apply` writes.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/enable-public-post-sharing.ts [--apply]
 */

const APPLY = process.argv.includes("--apply");

const EPOCH_KEY = "feed.public_audience_epoch";
const SWITCH_KEY = "feed.public_post_sharing";

async function main() {
  const existing = await prisma.systemSetting.findMany({
    where: { key: { in: [EPOCH_KEY, SWITCH_KEY] } },
    select: { key: true, value: true },
  });
  const have = new Map(existing.map((r) => [r.key, r.value]));

  // Keep an epoch that is already there — see the comment above.
  const currentEpoch = have.get(EPOCH_KEY);
  const epoch =
    typeof currentEpoch === "string" && Number.isFinite(Date.parse(currentEpoch))
      ? currentEpoch
      : new Date().toISOString();
  const reused = epoch === currentEpoch;

  // How many posts this actually publishes, said out loud before it happens.
  const [totalPosts, wouldPublish] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({
      where: {
        isPublic: true,
        createdAt: { gte: new Date(epoch) },
        isHidden: false,
        groupId: null,
        user: { status: "ACTIVE" },
      },
    }),
  ]);

  console.log(`${EPOCH_KEY}   = ${epoch}${reused ? "  (kept)" : "  (new)"}`);
  console.log(`${SWITCH_KEY}    = true  (was ${String(have.get(SWITCH_KEY) ?? "unset")})`);
  console.log(
    `posts publicly readable after this: ${wouldPublish} of ${totalPosts}`
  );
  console.log(
    `posts that stay members-only:       ${totalPosts - wouldPublish}`
  );

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply.");
    return;
  }

  await prisma.systemSetting.upsert({
    where: { key: EPOCH_KEY },
    create: {
      key: EPOCH_KEY,
      value: epoch,
      category: "feed",
      description:
        "Instant the post audience picker went live. Posts created before it are members-only whatever isPublic says.",
    },
    // `update: {}` on purpose — an existing epoch is never overwritten.
    update: {},
  });
  await prisma.systemSetting.upsert({
    where: { key: SWITCH_KEY },
    create: {
      key: SWITCH_KEY,
      value: true,
      category: "feed",
      description:
        "Master switch for logged-out post pages (/post/[id], OG image, sitemap).",
    },
    update: { value: true },
  });

  console.log("\nApplied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
