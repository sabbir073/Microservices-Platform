import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { USER_HOME } from "../src/lib/routes";

/**
 * App shell: the rail scrolls, and there is one definition of "home".
 *
 * Two failures this pins down, both of which look fine in code review:
 *
 *  - A `sticky` column with no `max-height` and no `overflow` has no scrollbar
 *    of its own, so anything past the fold is simply unreachable. Either half of
 *    the fix alone leaves it broken, which is why both are asserted.
 *  - `/social` and `/dashboard` were both used as "the user's home page" in
 *    different files. The middleware sent a non-admin hitting /admin to
 *    `/social` while the admin page's own guard sent the same person to
 *    `/dashboard` — two answers in one request path.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-app-shell.ts
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
/** Source with comments stripped, so prose can't satisfy a rule. */
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function main() {
  console.log("\n=== App shell ===\n");

  /* ── 1. The right rail ── */
  console.log("1. The social rail scrolls on its own");
  {
    const v = code("src/components/user/feed/social-feed-view.tsx");
    const rail =
      v.match(/<aside className="hidden xl:block[^"]*">\s*<div className="([^"]+)"/)?.[1] ?? "";
    check("the rail's sticky container was found", rail.length > 0, rail.slice(0, 60));

    check("it is still sticky", /(^|\s)sticky(\s|$)/.test(rail));
    // Both halves are required. A max-height with no overflow just clips; an
    // overflow with no height bound never triggers.
    check("it has a height bound", /max-h-\[/.test(rail), rail);
    check("it has its own scrollbar", /overflow-y-auto/.test(rail), rail);
    check(
      "the height bound accounts for the anchor ad bar",
      /--anchor-ad-h/.test(rail),
      rail
    );
    // Measured in Chrome: the rail holds ~2600px of widgets in a 666px window,
    // and `scrollbar-thin` renders 4px — which sat inside `pr-1`'s 4px of
    // padding and was invisible on a dark background. The column scrolled fine;
    // there was no way to tell that it could. The default 8px track is the
    // affordance, so neither the thin variant nor the padding that hid it may
    // come back.
    check(
      "the scrollbar is not the near-invisible thin variant",
      !/scrollbar-thin/.test(rail) && !/scrollbar-none/.test(rail),
      rail
    );
    check(
      "there is room for the 8px track beside the cards",
      /(^|\s)pr-2(\s|$)/.test(rail),
      rail
    );
    // A flick at the end of the rail should not carry on into the page behind.
    check("scrolling does not chain to the page", /overscroll-contain/.test(rail));

    // `self-start` on the aside would shrink it to its content, leaving `sticky`
    // nothing to travel inside — the classic silent way to break this.
    const aside = v.match(/<aside className="(hidden xl:block[^"]*)"/)?.[1] ?? "";
    check(
      "the aside is left to stretch, so sticky still has room to travel",
      aside.length > 0 && !/self-start/.test(aside),
      aside
    );

    // The column that was already right must stay right.
    check(
      "the left nav still scrolls independently",
      /flex-1 overflow-y-auto/.test(code("src/components/dashboard/sidebar.tsx"))
    );
  }

  /* ── 2. One home ── */
  console.log("\n2. One definition of home");
  {
    check("USER_HOME is /social", USER_HOME === "/social", USER_HOME);

    // The two places that already agreed, read from source — a change to either
    // without the constant fails here.
    check(
      "the sidebar's Home entry points at it",
      new RegExp(`\\{ name: "Home", href: "${USER_HOME}"`).test(
        code("src/components/dashboard/sidebar.tsx")
      )
    );
    check(
      "the login page falls back to it",
      new RegExp(`callbackUrl"\\) \\|\\| "${USER_HOME}"`).test(
        code("src/app/(auth)/login/page.tsx")
      )
    );
    check(
      "the auth middleware sends a non-admin there",
      new RegExp(`new URL\\("${USER_HOME}", nextUrl\\)`).test(
        code("src/lib/auth/config.ts")
      )
    );

    // The admin sidebar's mobile overlay is mounted unconditionally and shown
    // by class. As a conditional first child it changed the fragment's child
    // count, so any DOM perturbation before hydration shifted every following
    // node and surfaced as a whole-tree hydration mismatch rooted at the
    // sidebar.
    {
      const sb = code("src/components/admin/sidebar.tsx");
      check(
        "the mobile overlay is not conditionally mounted",
        !/\{isMobileOpen && \(/.test(sb),
        "a conditional first child makes the sibling count differ between renders"
      );
      check(
        "…and it cannot swallow clicks while closed",
        /opacity-0 pointer-events-none/.test(sb),
        "an always-mounted full-screen overlay without this blocks every click in the admin"
      );
      check(
        "a closed drawer is hidden from assistive tech",
        (sb.match(/aria-hidden=\{!isMobileOpen\}/g) ?? []).length === 2,
        "it is only moved off-screen, so its links otherwise stay in the tab order"
      );
    }

    // The sites that used to disagree.
    const RETURN_SITES = [
      "src/components/admin/header.tsx",
      "src/components/admin/sidebar.tsx",
      "src/components/tutor/TutorShell.tsx",
      "src/app/admin/layout.tsx",
      "src/app/admin/page.tsx",
      "src/app/(auth)/register/page.tsx",
    ];
    const stale = RETURN_SITES.filter((f) =>
      /href="\/dashboard"|redirect\("\/dashboard"\)|callbackUrl: "\/dashboard"/.test(
        code(f)
      )
    );
    check(
      "no return-to-app site still hardcodes /dashboard",
      stale.length === 0,
      stale.join(", ")
    );
    const notUsingConstant = RETURN_SITES.filter(
      (f) => !/USER_HOME/.test(code(f))
    );
    check(
      "each of them uses the shared constant",
      notUsingConstant.length === 0,
      notUsingConstant.join(", ")
    );

    // The negative that matters. These buttons SAY "Dashboard", so their href
    // and label agree; a blanket rewrite would make them lie.
    const LABELLED_DASHBOARD = [
      "src/app/(main)/error.tsx",
      "src/app/(main)/not-found.tsx",
      "src/app/error.tsx",
      "src/app/not-found.tsx",
      "src/app/(main)/no-access/page.tsx",
      "src/app/(main)/article-tasks/complete/_components/ArticleTaskCompleteClient.tsx",
    ];
    const rewritten = LABELLED_DASHBOARD.filter(
      (f) => !/href="\/dashboard"/.test(code(f))
    );
    check(
      "the links labelled 'Dashboard' still point at /dashboard",
      rewritten.length === 0,
      rewritten.join(", ")
    );
    // And /dashboard is still a real destination, not orphaned.
    check(
      "the Dashboard nav entry still exists",
      /href: "\/dashboard"/.test(code("src/components/dashboard/sidebar.tsx")) &&
        fs.existsSync(path.join(root, "src/app/(main)/dashboard/page.tsx"))
    );
  }

  /* ── 3. One navigation model per width ── */
  console.log("\n3. One navigation model at every width");
  {
    const sb = code("src/components/dashboard/sidebar.tsx");
    const bar = code("src/components/dashboard/bottom-tab-bar.tsx");
    const hdr = code("src/components/dashboard/header.tsx");
    const layout = code("src/app/(main)/layout.tsx");

    // The rail, the drawer, the hamburger and the tab bar must all switch at
    // the SAME breakpoint. When the rail started at `lg` and nothing else did,
    // a 768–1023px tablet got the phone shell — hamburger, drawer and bottom
    // bar — with 250px of dead gutter on either side of the content.
    check(
      "the persistent rail starts at md",
      /md:fixed[^"]*md:flex/.test(sb),
      "the rail must be on screen for tablets, not only laptops"
    );
    check("the phone drawer is md:hidden", /md:hidden/.test(sb) && !/lg:hidden/.test(sb), sb.match(/lg:hidden/)?.[0]);
    check("the bottom tab bar is md:hidden", /md:hidden fixed bottom-0/.test(bar));
    check(
      "the header hamburger hides at the same breakpoint",
      /items-center gap-1 md:hidden/.test(hdr)
    );
    // A bar that is `md:hidden` but polls on `max-width: 1023px` runs a 60s
    // fetch loop for every tablet and desktop user to feed a badge they cannot
    // see. The media query and the class have to name the same edge.
    check(
      "the tab bar's poll gate matches the breakpoint it renders at",
      /max-width: 767px/.test(bar),
      bar.match(/max-width: \d+px/)?.[0]
    );

    // Rail width and content offset are two numbers that must agree at BOTH
    // tiers; if either drifts the content sits under the rail or leaves a gap.
    check(
      "content is offset by the rail width at md and at lg",
      /md:w-64 lg:w-72/.test(sb) && /md:pl-64 lg:pl-72/.test(layout),
      layout.match(/md:pl-\d+ lg:pl-\d+/)?.[0]
    );
    check(
      "the page's bottom reserve drops where the tab bar does",
      /md:pb-\[calc\(2rem/.test(layout),
      "otherwise every tablet page keeps 96px of padding for a bar that is not there"
    );

    /* Search. It was an <input> with no handler, no form and no action — it
       looked like search and did nothing, on every page. */
    check(
      "the header search opens the real search surface",
      /GlobalSearch/.test(hdr) && /setIsSearchOpen\(true\)/.test(hdr),
      "a search box that is not wired to /api/search is decoration"
    );
    check(
      "search has an entry point on phones",
      /md:hidden[^"]*"\s*>\s*<Search/.test(hdr) ||
        /aria-label="Search"/.test(hdr),
      "the box was hidden below lg, so phones had no search at all"
    );
    check(
      "the rail can be filtered",
      /aria-label="Filter navigation"/.test(sb),
      "32 destinations need a way to jump, not only a way to scan"
    );

    /* Every destination that was reachable stays reachable. */
    const NAV_MUST_KEEP = [
      "/social", "/dashboard", "/wallet", "/saved", "/leaderboard",
      "/daily-mission", "/missions", "/tasks", "/board-tasks", "/watch-ads",
      "/quizzes", "/games", "/events", "/lottery",
      "/courses", "/my-learning", "/marketplace",
      "/referrals", "/affiliate", "/milestones", "/achievements",
      "/advertiser", "/create-task",
      "/deposit", "/withdrawal", "/transactions", "/packages", "/my-package",
      "/notifications", "/chat", "/support", "/settings",
    ];
    const missing = NAV_MUST_KEEP.filter(
      (h) => !new RegExp(`href: "${h}"`).test(sb)
    );
    check(
      `all ${NAV_MUST_KEEP.length} nav destinations survive the regrouping`,
      missing.length === 0,
      missing.join(", ")
    );

    /* Touch targets. 44px is the floor for anything a thumb hits. */
    check(
      "nav rows are at least 44px tall",
      (sb.match(/min-h-11/g) ?? []).length >= 3,
      "at py-2 these rows were 36px"
    );
    check("tab bar rows are at least 56px tall", (bar.match(/min-h-14/g) ?? []).length >= 2);
    check(
      "header icon buttons are 44px",
      (hdr.match(/w-11 h-11/g) ?? []).length >= 4,
      "p-2 around a 24px icon is a 40px target"
    );

    /* Safe areas — the bar and the rail both meet a device edge. */
    check("the tab bar pads for the home indicator", /safe-area-inset-bottom/.test(bar));
    check("…and for landscape notches", /safe-area-inset-left/.test(bar));
    check("the drawer clears the status bar", /safe-area-inset-top/.test(sb));
  }

  /* ── 4. Theme tokens are defined for both themes ── */
  console.log("\n4. Every shell/marketing colour exists in both themes");
  {
    const css = read("src/app/globals.css");
    const block = (sel: string) => {
      const i = css.indexOf(sel);
      if (i < 0) return "";
      const open = css.indexOf("{", i);
      // Token blocks here are flat (no nesting), so the first `}` closes them.
      return css.slice(open, css.indexOf("}", open));
    };
    const varsIn = (s: string) =>
      new Set((s.match(/--(?:shell|mk)-[a-z0-9-]+(?=\s*:)/g) ?? []));

    // The shell tokens live in :root (dark) and are re-declared in the light
    // block. A colour defined in only one of them is a colour that vanishes —
    // or glares — the moment the user flips the switch.
    // `block()` keys off the first `{` after a selector, which a leading
    // comment inside the rule would skip past — so slice this one directly.
    const shellStart = css.indexOf("/* ── App chrome (sidebar");
    const darkShell = varsIn(
      shellStart < 0 ? "" : css.slice(shellStart, css.indexOf("}", shellStart))
    );
    const lightShell = varsIn(block('html[data-theme="light"] {\n  /* Text ramp'));
    const shellOnlyDark = [...darkShell].filter(
      (v) => v.startsWith("--shell") && !lightShell.has(v)
    );
    check(
      "every --shell-* token is declared in both themes",
      darkShell.size > 0 && shellOnlyDark.length === 0,
      shellOnlyDark.join(", ")
    );

    const mkLight = varsIn(block('[data-mk-theme="light"]'));
    const mkDark = varsIn(block('[data-mk-theme="dark"]'));
    const mkMismatch = [
      ...[...mkLight].filter((v) => !mkDark.has(v)).map((v) => `${v} (light only)`),
      ...[...mkDark].filter((v) => !mkLight.has(v)).map((v) => `${v} (dark only)`),
    ];
    check(
      `every --mk-* token is declared in both themes (${mkLight.size})`,
      mkLight.size > 0 && mkMismatch.length === 0,
      mkMismatch.join(", ")
    );

    // A pure-white page behind pure-white cards has no depth at all; that was
    // the landing page's whole problem in light mode.
    const mkBg = block('[data-mk-theme="light"]').match(/--mk-bg:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    const mkSurface = block('[data-mk-theme="light"]').match(/--mk-surface:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    check(
      "the light marketing page is not the same colour as its cards",
      mkBg.length === 7 && mkBg.toLowerCase() !== mkSurface.toLowerCase(),
      `${mkBg} vs ${mkSurface}`
    );

    check(
      "the shell surface class is layered so utilities still win over it",
      /@layer components \{[\s\S]{0,400}\.app-chrome/.test(css),
      "an unlayered .app-chrome would override any bg-* class put on the header"
    );
  }

  console.log(
    `\n${passed} passed, ${failures.length} failed` +
      (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}\n` : "\n")
  );
  if (failures.length) process.exitCode = 1;
}

main();
