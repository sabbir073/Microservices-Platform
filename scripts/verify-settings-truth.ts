import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import {
  CATEGORY_FOR_KEY,
  SETTINGS_CATALOG,
  SETTINGS_ELSEWHERE,
  SETTING_GROUPS,
  searchSettings,
  settingEntry,
} from "../src/lib/admin-settings-catalog";

/**
 * Every control on the settings screens must do something.
 *
 * `/admin/settings` shipped with 44 boxes that wrote a `SystemSetting` row no
 * code path ever read. Pressing Save produced a success toast and no change in
 * behaviour, which is worse than having no control at all — the owner set the
 * withdrawal fee to 2.5% in a box bound to `withdrawal_fee_pct` while every
 * payout read `withdrawal_fee_percent` and charged the 5% code default.
 *
 * There were also two settings UIs. `/admin/settings/[category]` was orphaned —
 * nothing linked to it — and wrote a rival key namespace (`site_name` beside
 * `platform_name`, `smtp_user` beside `smtp_username`). It was simultaneously
 * the ONLY editor for `allow_withdrawals`, the platform-wide withdrawal
 * kill-switch, so that switch had no reachable UI at all.
 *
 * The general rule this file enforces, in both directions:
 *   every key the form WRITES is read by something,
 *   and every key the code READS has an editor somewhere in the admin.
 *
 * That is what stops the next dead box from being added.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-settings-truth.ts
 */

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

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

const FORM = "src/components/admin/settings/system-settings-form.tsx";

/** Every .ts/.tsx under src + scripts, excluding generated Prisma output. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "generated" || e.name === "node_modules") continue;
        walk(rel);
      } else if (/\.tsx?$/.test(e.name)) {
        out.push(rel);
      }
    }
  };
  walk("src");
  walk("scripts");
  return out;
}

/**
 * Keys that legitimately have no reader in this repo: they are read by the
 * browser-side toggle map, or they are credentials consumed through
 * `getSecret()` with the key spelled at the call site. Each entry needs a
 * reason — an unexplained exemption is how the dead boxes came back.
 */
const READER_EXEMPT = new Map<string, string>([
  // Read through the `ui-toggles-server.ts` map rather than a literal.
  ["ui.require_email_verification", "ui-toggles-server.ts map"],
]);

/**
 * Live keys whose editor exists but cannot be found by searching for the key
 * as a literal. Same rule as above: a reason, or it does not belong here.
 */
const EDITOR_EXEMPT = new Map<string, string>([
  [
    "lb_eligible_packages",
    "leaderboard-settings-form.tsx builds its keys as `lb_${k}`",
  ],
]);

async function main() {
  console.log("\n=== Settings tell the truth ===\n");

  const files = sourceFiles();
  const bodies = new Map(files.map((f) => [f, read(f)]));
  const form = bodies.get(FORM)!;

  /* ── 1. The rival settings surface is gone ── */
  console.log("1. One settings surface, not two");
  {
    check(
      "the orphaned /admin/settings/[category] page is deleted",
      !fs.existsSync(path.join(root, "src/app/admin/settings/[category]/page.tsx"))
    );
    check(
      "its SettingsForm is deleted with it",
      !fs.existsSync(
        path.join(root, "src/app/admin/settings/_components/SettingsForm.tsx")
      )
    );
    // The keys it owned had to move, not vanish.
    for (const key of [
      "allow_withdrawals",
      "withdrawal_requires_subscription",
      "withdrawal_payout_time_message",
      "withdrawal_fee_percent",
    ]) {
      check(`${key} survived the deletion — it is on the live form`, form.includes(`"${key}"`));
    }
  }

  /* ── 2. No control writes a key nothing reads ── */
  console.log("\n2. Every box on the form does something");
  {
    const written = [...form.matchAll(/set\("([^"]+)"/g)].map((m) => m[1]);
    const uniqueWritten = [...new Set(written)];
    check("the form still writes settings", uniqueWritten.length > 20);

    const dead: string[] = [];
    for (const key of uniqueWritten) {
      if (READER_EXEMPT.has(key)) continue;
      const readSomewhere = files.some(
        (f) =>
          f !== FORM &&
          !f.startsWith("scripts/verify-settings-truth") &&
          bodies.get(f)!.includes(`"${key}"`)
      );
      if (!readSomewhere) dead.push(key);
    }
    check(
      "no key is written by the form and read by nothing",
      dead.length === 0,
      dead.length ? `dead: ${dead.join(", ")}` : undefined
    );
  }

  /* ── 3. The keys that used to be dead really are wired now ── */
  console.log("\n3. The specific controls that were lying");
  {
    check(
      "the withdrawal fee box writes the key payouts read",
      form.includes('set("withdrawal_fee_percent"') &&
        !form.includes('set("withdrawal_fee_pct"')
    );
    check(
      "withdrawal.ts reads it",
      read("src/lib/withdrawal.ts").includes('"withdrawal_fee_percent"')
    );
    check(
      "max_withdrawals_per_day is the real cap, not a hardcoded 24h cooldown",
      read("src/lib/withdrawal.ts").includes('"max_withdrawals_per_day"') &&
        read("src/app/api/withdrawals/route.ts").includes("wcfg.maxPerDay")
    );
    check(
      "max_referrals_per_user gates referral attribution at signup",
      read("src/lib/auth/services.ts").includes('"max_referrals_per_user"')
    );
    check(
      "max_active_listings gates listing creation",
      read("src/app/api/marketplace/listings/route.ts").includes(
        '"max_active_listings"'
      )
    );
    check(
      "SMTP settings drive outgoing mail, not just env vars",
      read("src/lib/mailer.ts").includes('getSetting<string>("smtp_host"') &&
        !/nodemailer\.createTransport/.test(read("src/lib/email.ts"))
    );
    check(
      "the test-email button tests what was saved",
      read("src/app/api/admin/settings/test-email/route.ts").includes(
        "getMailConfig"
      )
    );
    check(
      "platform_name names the mail sender and the 2FA issuer",
      read("src/lib/system-settings.ts").includes("getPlatformName") &&
        read("src/app/api/2fa/setup/route.ts").includes("getPlatformName")
    );
  }

  /* ── 4. Controls that moved point at where they moved to ── */
  console.log("\n4. Nothing was removed without saying where it went");
  {
    for (const [label, href] of [
      ["Referral commission %", "/admin/referrals/settings"],
      ["Task reward multiplier", "/admin/packages"],
      ["Max tasks per day", "/admin/packages"],
    ] as const) {
      const block = new RegExp(
        `label="${label}"[\\s\\S]{0,200}?href="${href}"`,
        "i"
      );
      check(`"${label}" links to ${href}`, block.test(form));
    }
  }

  /* ── 5. No live setting is left without an editor ── */
  console.log("\n5. Every setting the code reads can be changed by an admin");
  {
    const readKeys = new Set<string>();
    for (const [f, body] of bodies) {
      if (f.startsWith("scripts/")) continue;
      for (const m of body.matchAll(
        /getSetting<[^>]*>\(\s*"([^"]+)"|getSecret\(\s*"[^"]+"\s*,\s*"([^"]+)"/g
      )) {
        readKeys.add(m[1] ?? m[2]);
      }
    }
    check("the codebase reads settings", readKeys.size > 30);

    // An "editor" is any admin page or component that names the key.
    // The settings CATALOG counts as an editor surface too. It is not under
    // /admin/, but it is what the admin screens render their controls and their
    // search index from, so a key listed there is genuinely reachable. This
    // matters for the leaderboard form, which builds its keys as `lb_${k}` and
    // therefore contains no literal `"lb_auto_reset"` to match on — the control
    // is real, the string simply never appears in the file.
    const adminFiles = files.filter(
      (f) =>
        f.includes("/admin/") ||
        f.includes("components/admin") ||
        f.includes("admin-settings-catalog")
    );
    const noEditor = [...readKeys].filter(
      (k) =>
        !EDITOR_EXEMPT.has(k) &&
        !adminFiles.some((f) => bodies.get(f)!.includes(`"${k}"`))
    );
    check(
      "no live setting is unreachable from the admin",
      noEditor.length === 0,
      noEditor.length ? `no editor: ${noEditor.join(", ")}` : undefined
    );
  }

  /* ── 6. The stale rows are gone from this database ── */
  console.log("\n6. The database has no rows under the retired keys");
  {
    const retired = [
      "withdrawal_fee_pct",
      "task_reward_multiplier",
      "referral_l1_pct",
      "referral_l2_pct",
      "referral_l3_pct",
      "site_name",
      "daily_earning_limit",
      "max_tasks_per_day",
      "file_upload_max_mb",
      "api_rate_limit_per_min",
    ];
    const left = await prisma.systemSetting.findMany({
      where: { key: { in: retired } },
      select: { key: true },
    });
    check(
      "scripts/migrate-settings-keys.ts has been applied",
      left.length === 0,
      left.length ? `still present: ${left.map((r) => r.key).join(", ")}` : undefined
    );

    // The fee the platform actually charges must exist and be sane, because
    // its absence silently falls back to the 5% code default.
    const fee = await prisma.systemSetting.findUnique({
      where: { key: "withdrawal_fee_percent" },
      select: { value: true },
    });
    const feeNum = Number(fee?.value);
    check(
      "withdrawal_fee_percent is set to a percentage",
      fee !== null && Number.isFinite(feeNum) && feeNum >= 0 && feeNum <= 100,
      `value=${JSON.stringify(fee?.value)}`
    );
  }

  /* ── The marketplace fee is one admin-set number, not four ───────────── */
  console.log("\nMarketplace fee — admin-set, and only in one place");
  {
    const code = (p: string) =>
      read(p)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

    const orders = code("src/app/api/marketplace/orders/route.ts");
    const commission = code("src/lib/marketplace-commission.ts");
    const form = code(FORM);

    check(
      "orders/route.ts no longer carries its own fee constant",
      !/PLATFORM_FEE_PERCENT\s*=/.test(orders),
      "a second hardcoded fee is a second source of truth"
    );
    check(
      "orders/route.ts resolves the fee the way the other checkout paths do",
      /resolveCommissionBps\(\{/.test(orders) && /splitPrice\(/.test(orders)
    );
    check(
      "the commission default is read from marketplace.fee_percent",
      /getSetting<number>\(\s*FEE_PERCENT_KEY/.test(commission) &&
        /FEE_PERCENT_KEY\s*=\s*"marketplace\.fee_percent"/.test(commission)
    );
    check(
      "saving the advanced commission editor writes that SAME key",
      /upsert\(\{\s*where:\s*\{\s*key:\s*FEE_PERCENT_KEY/.test(commission),
      "otherwise the two admin screens disagree about the fee"
    );
    check(
      "the settings form binds a control to the same key (both ends match)",
      /set\("marketplace\.fee_percent"/.test(form) &&
        /values\["marketplace\.fee_percent"\]/.test(form)
    );
    check(
      "…and files it under the financial group",
      CATEGORY_FOR_KEY["marketplace.fee_percent"] === "financial"
    );
    check(
      "the fee is clamped to a percentage",
      /"marketplace\.fee_percent":\s*\{[\s\S]{0,120}min:\s*0,[\s\S]{0,60}max:\s*100/.test(
        code("src/lib/setting-guards.ts")
      )
    );
  }

  /* ── 7. One catalog describes every setting, and search can find it ──── */
  console.log("\n7. Every setting has a name, a description, and is findable");
  {
    const keys = [...new Set([...form.matchAll(/set\("([^"]+)"/g)].map((m) => m[1]))];

    // 7a. The form describes nothing itself — it names a key and the catalog
    //     supplies the label and the description. That is what keeps the label
    //     an admin reads and the key the code reads from drifting apart.
    const uncatalogued = keys.filter((k) => !settingEntry(k));
    check(
      "every key the form writes has a catalog entry",
      uncatalogued.length === 0,
      uncatalogued.length ? `missing: ${uncatalogued.join(", ")}` : undefined
    );
    const unbound = keys.filter((k) => !form.includes(`settingKey="${k}"`));
    check(
      "every control is bound to its key with settingKey",
      unbound.length === 0,
      unbound.length ? `not bound: ${unbound.join(", ")}` : undefined
    );
    check(
      "the form no longer keeps its own copy of the key → tab map",
      !/const CATEGORY_FOR_KEY[^=]*=\s*\{/.test(form) &&
        form.includes('from "@/lib/admin-settings-catalog"'),
      "two copies of that map is how a control saves into the void"
    );

    // 7b. A control with no description is the next dead control: nobody can
    //     tell whether it does what they hope it does.
    const undescribed = SETTINGS_CATALOG.filter(
      (e) => !e.label.trim() || e.description.trim().length < 20
    ).map((e) => e.key);
    check(
      "every catalogued setting has a name and a real description",
      undescribed.length === 0,
      undescribed.length ? `thin: ${undescribed.join(", ")}` : undefined
    );
    const elsewhereThin = SETTINGS_ELSEWHERE.filter(
      (e) => !e.label.trim() || e.description.trim().length < 20 || !e.href
    ).map((e) => e.label);
    check(
      "every setting that lives on another screen says where and why",
      elsewhereThin.length === 0,
      elsewhereThin.join(", ")
    );

    // 7c. The search box is the whole point: an admin who remembers one word
    //     must land on the control. Every key must be findable BY ITS KEY, by
    //     its own label, and the group it belongs to must be a real group.
    const unfindable = SETTINGS_CATALOG.filter((e) => {
      const byKey = searchSettings(e.key).some((h) => h.key === e.key);
      const byLabel = searchSettings(e.label).some((h) => h.key === e.key);
      return !byKey || !byLabel;
    }).map((e) => e.key);
    check(
      "the search index covers every key, by key and by name",
      unfindable.length === 0,
      unfindable.length ? `unfindable: ${unfindable.join(", ")}` : undefined
    );
    check(
      "searching a word an owner would actually type finds the right control",
      searchSettings("withdrawal").some(
        (h) => h.key === "withdrawal_fee_percent"
      ) && searchSettings("commission").length > 0
    );

    // 7d. Ordering is declared, not accidental.
    const orders = SETTING_GROUPS.map((g) => g.order);
    check(
      "every group is ordered deliberately, with a blurb and no ties",
      new Set(orders).size === orders.length &&
        SETTING_GROUPS.every((g) => g.blurb.trim().length > 20),
      "insertion order is not an order"
    );
    const strayGroup = SETTINGS_CATALOG.filter(
      (e) => !SETTING_GROUPS.some((g) => g.id === e.group)
    ).map((e) => e.key);
    check(
      "no setting is filed under a group that does not exist",
      strayGroup.length === 0,
      strayGroup.join(", ")
    );

    // 7e. The reverse of the dead-control bug: a key the code reads with no
    //     control at all. `social.ai_regenerate_limit` sat in DEFAULTS and in
    //     the category map — enough to look edited-able, editable nowhere.
    check(
      "social.ai_regenerate_limit is editable, not just defaulted",
      form.includes('settingKey="social.ai_regenerate_limit"') &&
        read("src/app/api/tasks/[id]/ai-recipe/route.ts").includes(
          '"social.ai_regenerate_limit"'
        )
    );

    // 7f. A settings screen nobody can reach is a settings screen that does
    //     not exist. /admin/marketplace/settings had no inbound link at all.
    const linksToMarketplaceSettings = files.some(
      (f) =>
        f !== "src/app/admin/marketplace/settings/page.tsx" &&
        !f.startsWith("scripts/") &&
        /href="\/admin\/marketplace\/settings"/.test(bodies.get(f)!)
    );
    check(
      "/admin/marketplace/settings is reachable from the admin UI",
      linksToMarketplaceSettings,
      "it was reachable only by typing the URL"
    );
  }

  console.log(
    `\n${failures.length === 0 ? "COMPLETE" : "FAILED"}: ${passed} passed, ${failures.length} failed`
  );
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
  }
  await prisma.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
