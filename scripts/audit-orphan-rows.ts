import "dotenv/config";
import { prisma } from "./_q";

/**
 * Read-only orphan sweep.
 *
 * Most parent/child links in this schema are real Postgres foreign keys, so
 * they cannot be orphaned. The ones listed here are SOFT references — a plain
 * String column with no `@relation` — which is usually deliberate (an audit or
 * ledger row has to survive the deletion of whatever it describes) but is also
 * exactly where a dangling pointer can hide and change what a row means.
 *
 * This prints counts only. It never writes.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/audit-orphan-rows.ts
 */

type Ref = {
  table: string;
  column: string;
  parent: string;
  parentKey?: string;
  note?: string;
};

const REFS: Ref[] = [
  { table: "Task", column: "createdById", parent: "User" },
  { table: "Task", column: "fundedByUserId", parent: "User" },
  { table: "Deposit", column: "userId", parent: "User" },
  { table: "ReferralEarning", column: "referredUserId", parent: "User" },
  { table: "AffiliateClick", column: "affiliateUserId", parent: "User" },
  { table: "AffiliateCommission", column: "buyerId", parent: "User" },
  { table: "QuizAttempt", column: "userId", parent: "User" },
  { table: "GameSession", column: "userId", parent: "User" },
  { table: "GameEarnLog", column: "userId", parent: "User" },
  { table: "BrowseEarnLog", column: "userId", parent: "User" },
  { table: "AdView", column: "userId", parent: "User" },
  { table: "AdEngagement", column: "userId", parent: "User" },
  { table: "AdCreditLedger", column: "userId", parent: "User" },
  { table: "PushSubscription", column: "userId", parent: "User" },
  { table: "Conversation", column: "user1Id", parent: "User" },
  { table: "Conversation", column: "user2Id", parent: "User" },
  { table: "ChatMessage", column: "senderId", parent: "User" },
  { table: "MarketplaceDeal", column: "buyerId", parent: "User" },
  { table: "MarketplaceDeal", column: "sellerId", parent: "User" },
  { table: "MarketplaceThread", column: "buyerId", parent: "User" },
  { table: "MarketplaceThread", column: "sellerId", parent: "User" },
  { table: "OfferwallClick", column: "userId", parent: "User" },
  { table: "OfferwallCompletion", column: "userId", parent: "User" },
  { table: "FraudEvent", column: "userId", parent: "User" },
  { table: "MissionActionLog", column: "userId", parent: "User" },
  { table: "SocialProofFingerprint", column: "userId", parent: "User" },
  { table: "SocialProofFingerprint", column: "taskId", parent: "Task" },
  { table: "ArticleTaskKey", column: "taskId", parent: "Task" },
  { table: "SocialActionLog", column: "postId", parent: "Post" },
  { table: "GameEarnLog", column: "gameId", parent: "Game" },
  { table: "OfferwallClick", column: "offerId", parent: "OfferwallOffer" },
];

async function main() {
  let orphaned = 0;
  for (const r of REFS) {
    const key = r.parentKey ?? "id";
    const sql =
      `SELECT COUNT(*)::int AS n FROM "${r.table}" c ` +
      `LEFT JOIN "${r.parent}" p ON p."${key}" = c."${r.column}" ` +
      `WHERE c."${r.column}" IS NOT NULL AND p."${key}" IS NULL`;
    try {
      const rows = (await prisma.$queryRawUnsafe(sql)) as unknown as {
        n: number;
      }[];
      const n = Number(rows[0]?.n ?? 0);
      if (n > 0) {
        orphaned++;
        console.log(`  ORPHAN ${r.table}.${r.column} -> ${r.parent}: ${n}`);
      } else {
        console.log(`  ok     ${r.table}.${r.column} -> ${r.parent}`);
      }
    } catch (e) {
      console.log(
        `  skip   ${r.table}.${r.column} -> ${r.parent} (${(e as Error).message.split("\n")[0]})`
      );
    }
  }
  console.log(`\n${REFS.length - orphaned} clean, ${orphaned} with orphans`);
  await prisma.$disconnect();
}

void main();
