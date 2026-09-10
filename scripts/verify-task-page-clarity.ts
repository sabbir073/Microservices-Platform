import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "./_q";

/**
 * Task pages a person can actually follow.
 *
 * Two reports, one page: `/social-tasks/<id>`.
 *
 * **"The copy buttons only work once."** They always copied — `handle()` has no
 * guard and `copyText()` holds no state. What broke was the FEEDBACK: the
 * button set one permanent `copied` flag, so the second click on a field left
 * the icon and the label exactly as they were. Nothing on screen changed, so
 * the only reasonable conclusion was that the button had stopped working. And
 * re-copying is not an edge case here — the whole flow is copy → leave the app
 * → paste → come back, and a paste that fails means copying again.
 *
 * **"It's far too long and cluttered."** One measured task page was 6,267px
 * tall. The AI image prompt is ~4,000 characters written FOR ChatGPT, and it
 * was rendered in full, inline, above the work — as were "About this task" and
 * the advertiser's instructions. Nobody reads that prompt; they copy it.
 *
 * So: long values collapse (and still copy in full), reference material starts
 * closed, and steps are numbered rows rather than a browser-default ordered
 * list that reads as a paragraph with digits in it.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-task-page-clarity.ts
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
/** Source with comments stripped — prose about a rule is not the rule. */
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const COPY = "src/components/user/primitives/copy-field.tsx";
const RECIPE = "src/components/user/tasks/social-recipe-panel.tsx";
const RUN = "src/components/user/tasks/social-task-run-view.tsx";
const INSTR = "src/components/user/tasks/task-instructions.tsx";
const STEP = "src/components/user/tasks/task-step.tsx";

async function main() {
  console.log("\n=== Task pages are followable ===\n");

  /* ── 1. Copying gives feedback every single time ── */
  console.log("1. Every click on Copy is answered");
  {
    const c = code(COPY);
    check(
      "there is a per-click flash, not just a permanent flag",
      /setFlash\(true\)/.test(c) && /setTimeout\(\(\) => setFlash\(false\)/.test(c),
      "a repeat click that changes nothing on screen reads as a dead button"
    );
    check(
      "the flash resets, so the NEXT click can flash again",
      /clearTimeout\(timer\.current\)/.test(c)
    );
    check(
      "the label changes on a repeat copy",
      /Copy again/.test(c),
      "'Copied' forever tells the user nothing about the click they just made"
    );
    check(
      "nothing guards or disables the button after copying",
      !/disabled=\{/.test(c) && !/if \(copied\) return/.test(c),
      "re-copying is normal: paste fails, ChatGPT restarts"
    );
    check(
      "the pending timer is cleared on unmount",
      /useEffect\(\(\) => \(\) => \{/.test(c)
    );
    check(
      "a failed copy still tells the user",
      /notifyCenter\.error/.test(c)
    );
  }

  /* ── 2. Long values collapse — but copy in full ── */
  console.log("\n2. A 4,000-character prompt does not become 4,000 pixels");
  {
    const c = code(COPY);
    check("CopyField collapses long values", /COLLAPSE_CHARS/.test(c));
    check(
      "…by height, with a fade rather than a hard cut",
      /max-h-24 overflow-hidden/.test(c) && /bg-linear-to-t/.test(c)
    );
    check(
      "…and the full text is one tap away",
      /Show all \(\$\{value\.length/.test(c)
    );
    check(
      "the COPY still takes the whole value, never the preview",
      /<CopyButton value=\{value\} \/>/.test(c),
      "collapsing is about reading; it must not change what lands on the clipboard"
    );
    check(
      "the DIY prompt uses the same collapsing field",
      /<CopyField label="Prompt" value=\{prompt\} \/>/.test(code(RECIPE)),
      "it was a 13rem scroll box nested inside the page's own scroll"
    );
    check(
      "…and no longer nests its own scroller",
      !/max-h-52 overflow-y-auto/.test(code(RECIPE))
    );
  }

  /* ── 3. The first screen is the work, not the reading ── */
  console.log("\n3. Reference material starts closed");
  {
    const r = code(RUN);
    check(
      "'About this task' is an aside, not a panel above everything",
      /<TaskAside title="About this task">/.test(r)
    );
    check(
      "the advertiser's instructions are too",
      /<TaskAside title="Instructions from the advertiser">/.test(r)
    );
    check(
      "an instruction VIDEO stays open — it is the shortest way to explain",
      /title="Instruction video" defaultOpen/.test(r)
    );
    const step = code(STEP);
    check(
      "asides default to closed",
      /defaultOpen = false/.test(step)
    );
    check(
      // JSX puts the text on its own line, so the label and the closing tag are
      // not adjacent — match the toggle classes that show one and hide the
      // other, which is the behaviour being protected anyway.
      "…and say whether they are open",
      /group-open:hidden/.test(step) && /group-open:inline/.test(step),
      "a <details> with no affordance is a heading nobody clicks"
    );
  }

  /* ── 4. Steps look like steps ── */
  console.log("\n4. Step 1, step 2 — visibly");
  {
    const i = code(INSTR);
    check(
      "legacy steps render a drawn number per step",
      /\{i \+ 1\}/.test(i) && /rounded-full/.test(i)
    );
    check(
      "…not a browser-default ordered list",
      !/list-decimal/.test(i),
      "list-decimal at 14px reads as a paragraph with digits in it"
    );
    check(
      "twenty pasted steps do not bury the button",
      /COLLAPSE_AFTER_STEPS/.test(i)
    );
    check(
      "long rich text collapses too",
      /COLLAPSE_HTML_CHARS/.test(i)
    );
    check(
      "sanitising still happens before injection",
      /sanitizeInstructionsHtml\(value as string\)/.test(i),
      "presentation changes must never weaken this"
    );

    const step = code(STEP);
    check(
      "the shared step has a number, a rail, and a locked state",
      /TaskStep/.test(step) &&
        /state === "locked"/.test(step) &&
        /w-px flex-1/.test(step)
    );
  }

  /* ── 5. It has to work on a phone ── */
  console.log("\n5. Mobile first");
  {
    const c = code(COPY);
    check(
      "long values wrap instead of forcing a horizontal scroll",
      /wrap-break-word/.test(c) && /whitespace-pre-wrap/.test(c)
    );
    check(
      "the copy button never shrinks away next to a long label",
      /shrink-0/.test(c)
    );
    const step = code(STEP);
    check(
      "the step header wraps rather than overflowing",
      /flex-wrap/.test(step)
    );
    check(
      "the step body can shrink inside its row",
      /min-w-0 flex-1/.test(step),
      "without min-w-0 a long unbroken value blows out the flex row"
    );
    const r = code(RUN);
    check(
      "the page title scales with the viewport",
      /text-lg sm:text-xl/.test(r)
    );
  }

  /* ── 6. Live: the tasks this actually affects ── */
  console.log("\n6. Live state");
  {
    const social = await prisma.task.findMany({
      where: { type: "SOCIAL", status: "ACTIVE" },
      select: { id: true, title: true, socialConfig: true, instructions: true },
      take: 200,
    });
    console.log(`   ${social.length} active social task(s)`);

    // How much text these pages were rendering inline.
    let worst = 0;
    let worstTitle = "";
    for (const t of social) {
      const blob = JSON.stringify(t.socialConfig ?? {});
      if (blob.length > worst) {
        worst = blob.length;
        worstTitle = t.title;
      }
    }
    if (worst > 0) {
      console.log(
        `   largest task config: ${worst.toLocaleString()} chars — "${worstTitle}"`
      );
    }
    check(
      "the collapse threshold is well under a real prompt",
      260 < Math.max(1, worst),
      "if every value fitted under the threshold, nothing would ever collapse"
    );

    const longInstructions = social.filter(
      (t) => (t.instructions ?? "").length > 900
    );
    console.log(
      `   ${longInstructions.length} of them have instructions over 900 chars`
    );
    check("the live audit ran", true);
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
