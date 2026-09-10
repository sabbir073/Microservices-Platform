import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";

/**
 * The money record, separable from the work log.
 *
 * The wallet's history tab listed every completed task alongside every deposit,
 * conversion and payout. On an active account the earnings drown everything
 * else — one live account here carries 44 transactions of which 30 are task
 * earnings — so "when did my withdrawal go out" is not answerable by scrolling.
 *
 * `/transactions` defaults to money moving and keeps the work log one tap away.
 *
 * It also fixes two filters that were broken by the buyer work: the "Task fees"
 * chip existed in the UI with NO server case behind it (so it silently returned
 * everything), and credit purchases landed in the generic "Purchase" bucket
 * where a buyer could not tell them from a marketplace order.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-transactions-page.ts
 */

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const API = "src/app/api/transactions/route.ts";
const HISTORY = "src/components/user/wallet/transaction-history.tsx";
const PAGE = "src/app/(main)/transactions/page.tsx";

async function main() {
  console.log("\n=== Transactions, apart from the task log ===\n");

  /* ── 1. Every source chip has a filter behind it ── */
  console.log("1. No chip without a filter");
  {
    const sources = code("src/lib/tx-sources.ts");
    const api = code(API);

    const declared = [
      ...sources.matchAll(/^\s{2}(\w+): \{ label:/gm),
    ].map((m) => m[1]);
    check("the taxonomy declares sources", declared.length > 10);

    // "other" has no clean server filter by design; everything else must.
    const missing = declared.filter(
      (k) => k !== "other" && !new RegExp(`case "${k}":`).test(api)
    );
    check(
      "every source the UI offers has a server-side filter",
      missing.length === 0,
      missing.length
        ? `no case for: ${missing.join(", ")} — the chip returns everything`
        : undefined
    );
  }

  /* ── 2. The buyer's credit is legible in their history ── */
  console.log("\n2. Task credit reads as task credit");
  {
    const sources = code("src/lib/tx-sources.ts");
    check(
      "credit buys and spends get their own source",
      /"taskcredit"/.test(sources) &&
        /taskcredit_|taskspend_/.test(sources),
      "they landed in the generic Purchase bucket beside marketplace orders"
    );
    const api = code(API);
    check(
      "…and the generic Purchase filter excludes them",
      /case "purchase":[\s\S]{0,300}NOT:[\s\S]{0,200}taskcredit_/.test(api),
      "otherwise one row shows under two different chips"
    );
    check(
      "the buyer commission is split out of the generic admin bucket",
      /case "taskfee":/.test(api) &&
        /case "admin":[\s\S]{0,300}NOT: \{ reference: \{ startsWith: "task_fee_"/.test(
          api
        )
    );
  }

  /* ── 3. Money and work are separable ── */
  console.log("\n3. The money view excludes the work log");
  {
    const api = code(API);
    check("there is a kind filter", /function kindWhere/.test(api));
    check(
      "money excludes per-task earnings",
      /kind === "money"[\s\S]{0,400}type: "EARNING"/.test(api)
    );
    check(
      "…but keeps the daily check-in, which is a payment not a task",
      /startsWith: "daily_"/.test(api)
    );
    check(
      "a source chip overrides the kind, so picking Tasks shows tasks",
      /!source \? kindWhere\(kind\)/.test(api),
      "otherwise the chip and the switch fight and the list goes empty"
    );

    const hist = code(HISTORY);
    check("the component takes a default kind", /defaultKind/.test(hist));
    check("…and can render the switch", /showKindToggle/.test(hist));
    check(
      "changing the switch clears the source chip",
      /setKind\(k\);[\s\S]{0,200}setSource\("all"\)/.test(hist),
      "a pinned chip would make the switch look dead"
    );
    check(
      "the fetch re-runs when the kind changes",
      /\[range, day, source, kind, page\]/.test(hist),
      "a missing dependency here is a filter that only applies on the next click"
    );
  }

  /* ── 4. It is a real page, reachable and hideable ── */
  console.log("\n4. Reachable");
  {
    check("the page exists", fs.existsSync(path.join(root, PAGE)));
    check(
      "it defaults to money and shows the switch",
      /defaultKind="money"/.test(read(PAGE)) && /showKindToggle/.test(read(PAGE))
    );
    check(
      "there is a nav entry",
      /href: "\/transactions"/.test(code("src/components/dashboard/sidebar.tsx"))
    );
    check(
      "…and page-visibility can hide it per user",
      /"\/transactions"/.test(code("src/lib/page-visibility.ts"))
    );
    check(
      "the wallet tab still works, unchanged",
      /<TransactionHistory \/>/.test(
        code("src/components/user/wallet/wallet-view.tsx")
      ),
      "the new page is an addition, not a replacement"
    );
  }

  /* ── 5. Live: the split is worth making ── */
  console.log("\n5. Live state");
  {
    const busiest = (await prisma.transaction.groupBy({
      by: ["userId"],
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 1,
    })) as unknown as { userId: string; _count: { _all: number } }[];

    if (busiest.length === 0) {
      console.log("   no transactions yet");
      check("the live audit ran", true);
    } else {
      const userId = busiest[0].userId;
      const all = await prisma.transaction.count({ where: { userId } });
      const money = await prisma.transaction.count({
        where: {
          userId,
          NOT: {
            OR: [
              { type: "EARNING", NOT: { reference: { startsWith: "daily_" } } },
              { type: { in: ["CHECKIN", "LOTTERY_WIN"] } },
            ],
          },
        },
      });
      console.log(
        `   busiest account: ${all} rows → ${money} on the money view (${all - money} task rows hidden)`
      );
      check(
        "the money view is genuinely narrower than everything",
        money < all,
        "if it hid nothing the page would not be worth having"
      );
      check("…and is not empty", money > 0);
    }
  }

  console.log(
    `\n${failures.length === 0 ? "COMPLETE" : "FAILED"}: ${passed} passed, ${failures.length} failed`
  );
  for (const f of failures) console.log(`  - ${f}`);
  await prisma.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
