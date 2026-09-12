import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";
import {
  parseBuyerBlocks,
  typeRefusal,
  platformRefusal,
  allPlatformKeys,
  type BuyerScope,
} from "../src/lib/buyer-scope";
import {
  BUYER_TASK_TYPES,
  BUYER_TASK_TYPE_META,
} from "../src/lib/buyer-task-types";
import {
  buyerQuizSchema,
  buildBuyerQuizQuestions,
  buyerAppInstallSchema,
  buildBuyerAppInstallConfig,
} from "../src/lib/buyer-task-configs";
import {
  assessArticleOriginality,
  articleRepetition,
} from "../src/lib/article-originality";

/**
 * Which platforms and which task types a buyer may use — globally, and one
 * buyer at a time.
 *
 * The gap this closes: a buyer's SOCIAL task took the platform and the action
 * as FREE TEXT. Nothing matched the 40-platform catalog, so a buyer's task got
 * none of the per-platform copy-steps and none of the Smart Auto Verification
 * an admin-built task gets — every submission fell to manual review, and there
 * was no platform value to gate on even if you wanted to.
 *
 * Now there are two levels. The admin's global lists say what buyers get in
 * general; `User.buyerBlocks` is the exception list for one account, so a buyer
 * who keeps posting rubbish on Pinterest loses Pinterest rather than their
 * account — and not everyone else's Pinterest.
 *
 * A BLOCK list, not an allow list. An allow list would have to be filled in
 * before any buyer could do anything and would freeze them out of every
 * platform added later.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-buyer-scope.ts
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

const CREATE = "src/app/api/tasks/create/route.ts";
const VIEW = "src/components/user/tasks/create-task-view.tsx";
const SCOPE = "src/lib/buyer-scope.ts";

function scopeOf(over: Partial<BuyerScope> = {}): BuyerScope {
  return {
    types: ["SOCIAL", "VIDEO", "CUSTOM"],
    platforms: allPlatformKeys(),
    globalTypes: ["SOCIAL", "VIDEO", "CUSTOM"],
    globalPlatforms: allPlatformKeys(),
    blocks: { types: [], platforms: [], note: "", at: null },
    ...over,
  };
}

async function main() {
  console.log("\n=== Buyer scope: platforms and types ===\n");

  /* ── 1. The catalog is real, and it is one list ── */
  console.log("1. Real platforms, not free text");
  {
    const keys = allPlatformKeys();
    check("the catalog has every platform", keys.length >= 40, `${keys.length}`);
    check("no duplicates", new Set(keys).size === keys.length);

    const view = code(VIEW);
    check(
      "the buyer picks a platform from a list, not a text box",
      /<select[\s\S]{0,400}pickPlatform/.test(view) &&
        !/placeholder="e\.g\. YouTube, Instagram"/.test(view),
      "free text matched no known platform, so buyer tasks got no recipe and no auto-verification"
    );
    check(
      "the action list comes from the chosen platform",
      /platformDef\?\.actions\.map/.test(view)
    );
    check(
      "changing platform clears the action",
      /setSocialPlatform\(key\);\s*setSocialAction\(""\)/.test(view),
      "otherwise an action from the previous platform survives and the server refuses it"
    );

    const create = code(CREATE);
    check(
      "the server rejects a platform the catalog does not know",
      /getPlatform\(d\.socialPlatform\.toUpperCase\(\)\)/.test(create)
    );
    check(
      "…and an action that platform does not offer",
      /def\.actions\.some\(\(a\) => a\.key === d\.socialAction\)/.test(create)
    );
    check(
      "the stored platform is normalised",
      /d\.socialPlatform\?\.toUpperCase\(\)/.test(create),
      "a lowercase value would miss every lookup that matches on the key"
    );
  }

  /* ── 2. Blocks are subtractive and default to open ── */
  console.log("\n2. A block list, defaulting to everything");
  {
    check(
      "an untouched buyer is blocked from nothing",
      parseBuyerBlocks(null).types.length === 0 &&
        parseBuyerBlocks(null).platforms.length === 0
    );
    check(
      "garbage in the column does not become a suspension",
      parseBuyerBlocks({ types: "PINTEREST", platforms: 7 }).types.length === 0
    );
    check(
      "keys are upper-cased, so casing cannot dodge a block",
      parseBuyerBlocks({ platforms: ["pinterest"] }).platforms[0] === "PINTEREST"
    );
    check(
      "duplicates collapse",
      parseBuyerBlocks({ types: ["CUSTOM", "CUSTOM"] }).types.length === 1
    );

    const scope = code(SCOPE);
    check(
      "the effective list is global MINUS blocked",
      /globalTypes\.filter\(\(t\) => !blockedTypes\.has\(t\)\)/.test(scope) &&
        /globalPlatforms\.filter\(\(p\) => !blockedPlatforms\.has\(p\)\)/.test(
          scope
        )
    );
    check(
      "an unset global platform list means ALL of them",
      /if \(!Array\.isArray\(raw\)\) return allPlatformKeys\(\)/.test(scope),
      "so a platform added to the catalog later is available without anyone ticking it"
    );
    check(
      "unknown keys in the global list are dropped",
      /filter\(\(k\) => known\.has\(k\)\)/.test(scope)
    );
  }

  /* ── 3. Refusals say which kind of refusal it is ── */
  console.log("\n3. 'Nobody can' and 'you cannot' read differently");
  {
    const suspended = scopeOf({
      types: ["SOCIAL", "VIDEO"],
      platforms: allPlatformKeys().filter((k) => k !== "PINTEREST"),
      blocks: {
        types: ["CUSTOM"],
        platforms: ["PINTEREST"],
        note: "repeated low-quality submissions",
        at: null,
      },
    });

    check("an allowed type is not refused", typeRefusal(suspended, "SOCIAL") === null);
    const t = typeRefusal(suspended, "CUSTOM") ?? "";
    check("a suspended type says it is suspended", /suspended on your account/.test(t));
    check("…and gives the reason the admin wrote", /low-quality/.test(t));

    const closed = scopeOf({ types: ["SOCIAL"], globalTypes: ["SOCIAL"] });
    const t2 = typeRefusal(closed, "CUSTOM") ?? "";
    check(
      "a type nobody may use does NOT say 'your account'",
      !/your account/.test(t2) && t2.length > 0,
      "blaming the buyer for a platform-wide policy sends them to support for nothing"
    );

    check(
      "an allowed platform is not refused",
      platformRefusal(suspended, "FACEBOOK") === null
    );
    const p1 = platformRefusal(suspended, "PINTEREST") ?? "";
    check("a suspended platform says so, with the reason", /suspended on your account/.test(p1) && /low-quality/.test(p1));
    check(
      "an unknown platform is named as unsupported",
      /isn't a platform we support/.test(platformRefusal(suspended, "MYSPACE") ?? "")
    );
    check(
      "lower case still matches a block",
      platformRefusal(suspended, "pinterest") !== null
    );
  }

  /* ── 4. Enforced on the server, not only in the form ── */
  console.log("\n4. The server is the gate");
  {
    const create = code(CREATE);
    check("the create route resolves the scope", /getBuyerScope\(userId\)/.test(create));
    check("…and refuses a blocked type", /typeRefusal\(scope, d\.type\)/.test(create));
    check("…and a blocked platform", /platformRefusal\(scope, d\.socialPlatform\)/.test(create));

    const page = code("src/app/(main)/create-task/page.tsx");
    check(
      "the form is only offered what the scope allows",
      /scope\.platforms\.includes\(p\.key\)/.test(page) &&
        /allowedTypes=\{scope\.types\}/.test(page),
      "an option the server will refuse is worse than no option"
    );
    check(
      "a buyer with nothing left sees a lock, not an empty form",
      /scope\.types\.length === 0/.test(page)
    );
  }

  /* ── 4b. SURVEY is a buyer type, gated on create AND on edit ── */
  console.log("\n4b. SURVEY: the fourth buyer type, and its privacy rule");
  {
    const create = code(CREATE);
    const edit = code("src/app/api/tasks/mine/[id]/route.ts");
    const responses = code("src/app/api/tasks/mine/[id]/responses/route.ts");
    const lib = code("src/lib/survey-buyer.ts");

    check(
      "SURVEY is one of the buyer task types",
      BUYER_TASK_TYPES.includes("SURVEY" as never),
      BUYER_TASK_TYPES.join(", ")
    );
    check(
      "the create route accepts SURVEY and validates the questions",
      /"SURVEY"/.test(create) && /validateSurveyConfig\(surveyConfig\)/.test(create),
      "an unvalidated survey is a task nobody can answer"
    );
    check(
      "…and it is still typeRefusal that decides who may create one",
      /typeRefusal\(scope, d\.type\)/.test(create)
    );
    check(
      "the EDIT route refuses a survey edit when SURVEY is suspended",
      /typeRefusal\(scope, "SURVEY"\)/.test(edit),
      "create a permitted type, then edit it across — the exact move the block exists to stop"
    );
    check(
      "…and refuses survey questions on a task that is not a survey",
      /task\.type !== "SURVEY"/.test(edit)
    );
    check(
      "one schema for both routes",
      /buyerSurveySchema/.test(create) && /buyerSurveySchema/.test(edit),
      "two copies is how an edit accepts what a create refuses"
    );

    // The privacy rule. These are the fields that must never be selected.
    check(
      "the buyer's response route never reads the respondent's account",
      !/user:\s*\{/.test(responses) && !/email/.test(responses),
      "worker identity must not leak to the buyer"
    );
    check(
      "responses are scoped to the task this buyer funded",
      /fundedByUserId: session\.user\.id/.test(responses)
    );
    check(
      "rows are pseudonymous and dated to the day only",
      /Respondent \$\{labels\.size \+ 1\}/.test(lib) &&
        /toISOString\(\)\.slice\(0, 10\)/.test(lib),
      "a to-the-second timestamp can be lined up against a public feed post"
    );
    check(
      "the rule is stated to the worker BEFORE they answer",
      /BUYER_SURVEY_NOTICE/.test(
        code("src/components/user/tasks/survey-task-detail-view.tsx")
      ),
      "a worker who has not been told is a worker who did not consent"
    );
    check(
      "…and the same words are shown to the buyer building it",
      /BUYER_SURVEY_NOTICE/.test(
        code("src/components/user/tasks/survey-builder.tsx")
      )
    );
    check(
      "a buyer survey never asks for a proof screenshot",
      /proofRequirements: \{ screenshot: false \}/.test(lib),
      "those routinely contain a profile page"
    );
    check(
      "no second money path — completions are charged the usual way",
      !/chargeTaskCompletion/.test(create) && !/transaction\.update/.test(responses)
    );
  }

  /* ── 5. Suspending is deliberate and explained ── */
  console.log("\n5. A suspension has to be explained");
  {
    const api = code("src/app/api/admin/users/[id]/buyer-blocks/route.ts");
    check("it needs users.edit", /can\(session\.user\.id, "users\.edit"\)/.test(api));
    check(
      "a reason is REQUIRED when anything is blocked",
      /note\.length < 5/.test(api),
      "a suspension nobody explains becomes a support ticket instead of a correction"
    );
    check(
      "unknown keys are dropped rather than stored",
      /knownTypes\.has\(t\)/.test(api) && /knownPlatforms\.has\(p\)/.test(api),
      "a typo saved here is an invisible, permanent suspension for something that does not exist"
    );
    check("both directions are audited", /BUYER_SUSPENDED/.test(api) && /BUYER_UNSUSPENDED/.test(api));
    check(
      "the buyer is told",
      /notifyUser/.test(api),
      "they will keep doing it until somebody says otherwise"
    );
    check(
      "clearing everything removes the record rather than storing empties",
      /Prisma\.JsonNull/.test(api)
    );

    const panel = code("src/components/admin/users/buyer-suspension-panel.tsx");
    check(
      // The platform list is rendered from a SEARCH-filtered copy, so match
      // the source it filters rather than a `.map` on the raw prop.
      "the admin panel offers both types and platforms",
      /BUYER_TASK_TYPES\.map/.test(panel) &&
        /platforms\.filter/.test(panel) &&
        /shown\.map/.test(panel)
    );
    check(
      "…and can lift everything in one action",
      /Lift everything/.test(panel)
    );
    check(
      "40 platforms are searchable rather than a wall",
      /setSearch/.test(panel)
    );
  }

  /* ── 6. Live ── */
  console.log("\n6. Live state");
  {
    const suspended = await prisma.user.findMany({
      where: { buyerBlocks: { not: Prisma_JsonNull() } },
      select: { email: true, buyerBlocks: true },
      take: 50,
    });
    console.log(`   ${suspended.length} account(s) with buyer suspensions`);
    for (const u of suspended) {
      const b = parseBuyerBlocks(u.buyerBlocks);
      console.log(
        `     ${u.email}: ${[...b.types, ...b.platforms].join(", ") || "none"}`
      );
    }
    check(
      "every stored suspension carries a reason",
      suspended.every((u) => {
        const b = parseBuyerBlocks(u.buyerBlocks);
        return b.types.length + b.platforms.length === 0 || b.note.length > 0;
      })
    );

    // Buyer social tasks should now carry a real platform key.
    const social = await prisma.task.findMany({
      where: { fundedByUserId: { not: null }, type: "SOCIAL" },
      select: { id: true, socialPlatform: true },
    });
    const known = new Set(allPlatformKeys());
    const unknown = social.filter(
      (t) => t.socialPlatform && !known.has(t.socialPlatform)
    );
    console.log(`   ${social.length} buyer social task(s)`);
    check(
      "no buyer social task carries a platform the catalog cannot match",
      unknown.length === 0,
      unknown.map((t) => `${t.id}=${t.socialPlatform}`).join(", ") || undefined
    );
  }

  // -- QUIZ / ARTICLE / APPINSTALL as buyer types ---------------------------
  //
  // Three types, three hazards. Each check below is one of those hazards, not a
  // tick-box: a regression here is an answer key in a network tab, a buyer
  // paying twice for the same paragraph, or the easiest fraud on the platform
  // shipping with a one-screenshot default.
  console.log("\n5. QUIZ / ARTICLE / APPINSTALL for buyers");
  {
    for (const t of ["QUIZ", "ARTICLE", "APPINSTALL"] as const) {
      check(
        `${t} is a buyer task type`,
        (BUYER_TASK_TYPES as readonly string[]).includes(t)
      );
      check(`${t} has a blurb saying what it is`, !!BUYER_TASK_TYPE_META[t]?.blurb);
    }

    const createRoute = read("src/app/api/tasks/create/route.ts");
    const editRoute = read("src/app/api/tasks/mine/[id]/route.ts");
    for (const schema of [
      "buyerQuizSchema",
      "buyerArticleSchema",
      "buyerAppInstallSchema",
    ]) {
      check(
        `${schema} is imported by BOTH the create and the edit route`,
        createRoute.includes(schema) && editRoute.includes(schema)
      );
    }
    check(
      "the edit route scope-checks the new types, not only SURVEY",
      /configEdits/.test(editRoute) &&
        /typeRefusal\(scope, edit\.type\)/.test(editRoute)
    );
    check(
      "neither route invents a second money path",
      // Mentioned in a comment on purpose; what matters is that neither route
      // IMPORTS it. Charging still happens once, per approved completion, in
      // the one place it always has.
      !/from "@\/lib\/task-charge/.test(createRoute) &&
        !/from "@\/lib\/task-charge/.test(editRoute) &&
        !/import[^;]*chargeTaskCompletion/.test(createRoute) &&
        !/import[^;]*chargeTaskCompletion/.test(editRoute)
    );

    // QUIZ -- the answer key must not reach the browser.
    const quizRoute = read("src/app/api/tasks/quiz/route.ts");
    const player = quizRoute.slice(
      quizRoute.indexOf("function toPlayerQuestions"),
      quizRoute.indexOf("// GET /api/tasks/quiz")
    );
    check(
      "the quiz player payload is built from question + options only",
      /question: q\.question/.test(player) &&
        /options: q\.options/.test(player) &&
        !/correctAnswer/.test(player) &&
        !/correctIndex/.test(player)
    );
    check(
      "grading reads the key from the task row, never from the request body",
      /coerceQuizQuestions\(task\.questions\)/.test(quizRoute) &&
        /key\[i\]\.correctAnswer/.test(quizRoute)
    );
    check(
      "a buyer cannot create a quiz with no questions (that would trigger AI generation)",
      /A quiz task needs at least one question/.test(createRoute)
    );
    const built = buildBuyerQuizQuestions({
      questions: [
        {
          question: " Capital? ",
          options: [" Dhaka ", "Delhi"],
          correctIndex: 0,
        },
      ],
    });
    check(
      "the builder writes correctAnswer (the canonical key name) and trims",
      built[0].correctAnswer === 0 &&
        built[0].options[0] === "Dhaka" &&
        built[0].question === "Capital?"
    );
    check(
      "a correctIndex past the end of the options is refused",
      !buyerQuizSchema.safeParse({
        questions: [{ question: "Q?", options: ["a", "b"], correctIndex: 3 }],
      }).success
    );

    // ARTICLE -- duplicate detection, and honesty about its limits.
    const submitRoute = read("src/app/api/tasks/[id]/submit/route.ts");
    check(
      "the submit route enforces the buyer's minimum word count",
      /articleWordCount\(/.test(submitRoute) &&
        /cfg\.writing\.minWords/.test(submitRoute)
    );
    check(
      "it scores originality against this task's other submissions",
      /assessArticleOriginality\(/.test(submitRoute)
    );
    check(
      "the comparison set is bounded, not the whole table",
      /take: 200/.test(submitRoute)
    );
    const dup = assessArticleOriginality("The quick brown fox jumps over it", [
      "the QUICK... brown  fox, jumps over IT!",
    ]);
    check(
      "the same text retyped with different punctuation is caught",
      dup.exactDuplicate && dup.maxSimilarity === 100
    );
    const fresh = assessArticleOriginality(
      "Completely different words about another subject entirely today",
      ["The quick brown fox jumps over it"]
    );
    check("unrelated writing is not flagged", fresh.maxSimilarity < 60);
    check(
      "padding -- one sentence repeated -- is measured",
      articleRepetition("buy this app now buy this app now buy this app now") >=
        35
    );
    check(
      "the note tells the reviewer the web was NOT checked",
      /Not checked against the web/.test(dup.note)
    );

    // APPINSTALL -- no weak default, no buyer auto-approve.
    check(
      "a buyer install task with no proof requirements is refused",
      !buyerAppInstallSchema.safeParse({
        appName: "App",
        appKind: "app",
        playStoreUrl: "https://play.google.com/store/apps/details?id=x",
        proofItems: [],
      }).success
    );
    const appCfg = buildBuyerAppInstallConfig({
      appName: "App",
      appKind: "game",
      playStoreUrl: "https://play.google.com/store/apps/details?id=x",
      proofItems: [
        { kind: "LEVEL", target: 5, screenshot: true },
        { kind: "DAYS", target: 3, screenshot: true },
      ],
    });
    check(
      "a buyer can never auto-approve their own install task",
      appCfg.autoApprove === false
    );
    check(
      "proof item ids are re-derived, so a hostile body cannot collapse them",
      appCfg.proofItems?.[0]?.id === "pi_1" &&
        appCfg.proofItems?.[1]?.id === "pi_2"
    );
    check(
      "a requirement that asks for neither a screenshot nor a value is refused",
      !buyerAppInstallSchema.safeParse({
        appName: "App",
        appKind: "app",
        playStoreUrl: "https://play.google.com/store/apps/details?id=x",
        proofItems: [{ kind: "INSTALL", screenshot: false }],
      }).success
    );
    check(
      "a store link is required",
      !buyerAppInstallSchema.safeParse({
        appName: "App",
        appKind: "app",
        proofItems: [{ kind: "INSTALL", screenshot: true }],
      }).success
    );
  }

  console.log(
    `\n${failures.length === 0 ? "COMPLETE" : "FAILED"}: ${passed} passed, ${failures.length} failed`
  );
  for (const f of failures) console.log(`  - ${f}`);
  await prisma.$disconnect();
  process.exit(failures.length === 0 ? 0 : 1);
}

/** Prisma's JSON-null sentinel without importing the namespace here. */
function Prisma_JsonNull() {
  return null as never;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
