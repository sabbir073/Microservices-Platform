import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { USER_HOME } from "../src/lib/routes";
import {
  DEFAULT_LANDING_CONTENT,
  withEarnCardLinks,
  withRequiredNavLinks,
} from "../src/lib/landing-content";

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
// Normalised to LF. `core.autocrlf` checks these files out with CRLF on
// Windows, and several checks below match multi-line literals — those
// silently found nothing and reported a token as missing from a theme it
// was in fact declared in.
const read = (p: string) =>
  fs.readFileSync(path.join(root, p), "utf8").split("\r\n").join("\n");
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

  /* ── 5. The public marketing pages and the paths into them ── */
  console.log("\n5. The marketing pages exist and are reachable");
  {
    const PAGES: Array<{ route: string; file: string }> = [
      { route: "/microtask", file: "src/app/(marketing)/microtask/page.tsx" },
      { route: "/advertise", file: "src/app/(marketing)/advertise/page.tsx" },
      { route: "/referral", file: "src/app/(marketing)/referral/page.tsx" },
    ];

    for (const p of PAGES) {
      const exists = fs.existsSync(path.join(root, p.file));
      check(`${p.route} has a page`, exists, p.file);
      if (!exists) continue;
      const src = code(p.file);
      // A page file with no default export renders nothing; Next treats it as
      // an invalid route rather than a blank one, so this is a 500, not an
      // empty page — worth pinning.
      check(`${p.route} exports a page component`, /export default function/.test(src));
      check(
        `${p.route} declares its own metadata`,
        /export function generateMetadata\(\): Metadata/.test(src)
      );
      check(
        `${p.route} sets a canonical URL`,
        new RegExp(`alternates:\\s*\\{\\s*canonical:\\s*"${p.route}"`).test(src)
      );
      check(`${p.route} has an og card`, /openGraph:\s*\{/.test(src));

      // No rate, price or percentage may be written into a marketing page.
      // Every reward and every ad price on this platform is a SystemSetting the
      // owner edits from the admin panel; a figure typed here goes stale
      // silently and is read by the public as a promise.
      const money = src.match(/\$\s?\d|\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s+(?:points|pts|USD|usd)\b/);
      check(
        `${p.route} quotes no hardcoded rate`,
        money === null,
        money ? `found "${money[0]}"` : undefined
      );
    }

    // The counted facts are rendered from the modules that define them, so the
    // page cannot drift from the catalog the way a typed-in number would.
    const micro = code("src/app/(marketing)/microtask/page.tsx");
    check(
      "the micro-task page counts the social catalog instead of stating it",
      /SOCIAL_PLATFORMS\.length/.test(micro) && /p\.actions\.length/.test(micro),
      "a literal platform/action count goes stale on the next catalog edit"
    );
    const adv = code("src/app/(marketing)/advertise/page.tsx");
    check(
      "the advertise page renders the real placement list",
      /AD_PLACEMENTS\.filter/.test(adv) && /SELLABLE\.length/.test(adv)
    );
    check(
      "the advertise page does not sell rewarded video",
      /name !== "REWARDED_VIDEO"/.test(adv),
      "rewarded video ships OFF — it must not appear as buyable inventory"
    );

    /* Nav: two in, one deliberately out. */
    const navHrefs = DEFAULT_LANDING_CONTENT.navbar.nav_links.map((l) => l.href);
    check("MicroTask is in the public menu", navHrefs.includes("/microtask"));
    check("Advertise is in the public menu", navHrefs.includes("/advertise"));
    check(
      "Referral is NOT in the public menu",
      !navHrefs.includes("/referral"),
      "the owner asked for this page to be linked, not listed"
    );

    // A stored navbar replaces the default array wholesale, so the menu entries
    // have to survive an admin who saved the section before they existed.
    const stripped = withRequiredNavLinks({
      ...DEFAULT_LANDING_CONTENT.navbar,
      nav_links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }],
    });
    const strippedHrefs = stripped.nav_links.map((l) => l.href);
    check(
      "a stored navbar missing them gets them back",
      strippedHrefs.includes("/microtask") && strippedHrefs.includes("/advertise"),
      strippedHrefs.join(" ")
    );
    check(
      "…and they land before Pricing rather than after it",
      strippedHrefs.indexOf("/advertise") < strippedHrefs.indexOf("#pricing"),
      strippedHrefs.join(" ")
    );

    /* Every "Multiple Ways to Earn" card points at a route that exists. */
    const items = withEarnCardLinks(DEFAULT_LANDING_CONTENT.features).items;
    const routeFile = (href: string): string | null => {
      const p = href.split("#")[0].replace(/\/$/, "");
      if (p === "") return "src/app/page.tsx";
      for (const base of ["src/app/(marketing)", "src/app/(main)", "src/app"]) {
        const f = `${base}${p}/page.tsx`;
        if (fs.existsSync(path.join(root, f))) return f;
      }
      return null;
    };
    const dead = items.filter((it) => !it.href || !routeFile(it.href));
    check(
      `every earn card links somewhere real (${items.length})`,
      items.length > 0 && dead.length === 0,
      dead.map((d) => `${d.title} → ${d.href ?? "(none)"}`).join(", ")
    );

    // The three cards the owner named, pointing at the three new pages.
    const hrefFor = (title: string) => items.find((i) => i.title === title)?.href;
    check("the Micro Tasks card opens /microtask", hrefFor("Micro Tasks") === "/microtask");
    check("the Advertiser Slots card opens /advertise", hrefFor("Advertiser Slots") === "/advertise");
    check("the Team & Referrals card opens /referral", hrefFor("Team & Referrals") === "/referral");

    // Three cards point at anchors rather than whole pages; an anchor with no
    // target scrolls nowhere and looks like a broken link.
    const anchors = items
      .map((i) => i.href ?? "")
      .filter((h) => h.includes("#"))
      .map((h) => h.split("#")[1]);
    const missingAnchors = anchors.filter((a) => !micro.includes(`id="${a}"`));
    check(
      `every card anchor exists on its page (${anchors.length})`,
      anchors.length > 0 && missingAnchors.length === 0,
      missingAnchors.join(", ")
    );

    /* Sitemap: all three, including the one that is not in the menu. */
    const sm = code("src/app/sitemap.ts");
    for (const p of PAGES) {
      check(`${p.route} is in the sitemap`, sm.includes(`"${p.route}"`));
    }

    /* Contrast. Computed, not eyeballed — both themes, 4.5:1 for body text. */
    const css = read("src/app/globals.css");
    const tokenIn = (theme: string, name: string) =>
      css
        .slice(css.indexOf(`[data-mk-theme="${theme}"]`))
        .match(new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, "i"))?.[1] ?? "";
    const lum = (hexIn: string) => {
      let h = hexIn.replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const ch = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const contrast = (a: string, b: string) => {
      const [la, lb] = [lum(a), lum(b)];
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    for (const theme of ["light", "dark"]) {
      for (const fg of ["mk-text", "mk-muted", "mk-subtle", "mk-accent"]) {
        for (const bg of ["mk-bg", "mk-band", "mk-surface"]) {
          const f = tokenIn(theme, fg);
          const b = tokenIn(theme, bg);
          const r = f && b ? contrast(f, b) : 0;
          check(
            `${theme}: ${fg} on ${bg} clears 4.5:1`,
            r >= 4.5,
            `${f} on ${b} = ${r.toFixed(2)}`
          );
        }
      }
    }
  }

  /* ── 6. The design system: type, rhythm, depth, motion, and the landing
         page's coded fallback ── */
  console.log("\n6. The marketing design system holds together");
  {
    const css = read("src/app/globals.css");

    /* 6a. The CSS-comment incident. A comment containing a Tailwind class pair
       with a star and a slash in it closes itself early, and the rest of the
       line is then parsed as CSS. That broke the build once (c6bf6fa).
       Stripping every comment and checking the braces still balance catches
       the whole class of it. */
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const opens = (stripped.match(/\{/g) ?? []).length;
    const closes = (stripped.match(/\}/g) ?? []).length;
    check(
      "globals.css braces balance once comments are stripped",
      opens === closes,
      `${opens} open vs ${closes} close`
    );

    /* 6b. Token parity across EVERY marketing theme block. The tokens are
       declared in more than one place now, so collect all of them rather than
       only the first block (which is what check 4 does). */
    const allVarsFor = (theme: string) => {
      const out = new Set<string>();
      const re = new RegExp(`\\[data-mk-theme="${theme}"\\]\\s*\\{`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(css))) {
        const body = css.slice(m.index, css.indexOf("}", m.index));
        for (const v of body.match(/--mk-[a-z0-9-]+(?=\s*:)/g) ?? []) out.add(v);
      }
      return out;
    };
    const lightVars = allVarsFor("light");
    const darkVars = allVarsFor("dark");
    const onlyOne = [
      ...[...lightVars].filter((v) => !darkVars.has(v)).map((v) => `${v} (light only)`),
      ...[...darkVars].filter((v) => !lightVars.has(v)).map((v) => `${v} (dark only)`),
    ];
    check(
      `every --mk-* token, in every block, exists in both themes (${lightVars.size})`,
      lightVars.size > 0 && onlyOne.length === 0,
      onlyOne.join(", ")
    );

    /* 6c. Contrast on the tokens added for the product mock and the section
       eyebrows. Computed from the file, not eyeballed. */
    const hexOf = (theme: string, name: string) => {
      const re = new RegExp(`\\[data-mk-theme="${theme}"\\]\\s*\\{`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(css))) {
        const body = css.slice(m.index, css.indexOf("}", m.index));
        const hit = body.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, "i"));
        if (hit) return hit[1];
      }
      return "";
    };
    const lum2 = (hexIn: string) => {
      let h = hexIn.replace("#", "");
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const ch = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const ratio = (a: string, b: string) => {
      const la = lum2(a);
      const lb = lum2(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    // Each pair is text painted on a fill the page actually puts it on.
    const PAIRS: [string, string][] = [
      ["mk-accent", "mk-accent-soft"],
      ["mk-success", "mk-success-soft"],
      ["mk-success", "mk-surface"],
      ["mk-success", "mk-surface-2"],
      ["mk-success", "mk-bg"],
      ["mk-accent", "mk-surface-2"],
      ["mk-subtle", "mk-surface-2"],
      ["mk-muted", "mk-surface-2"],
    ];
    for (const theme of ["light", "dark"]) {
      for (const [fg, bg] of PAIRS) {
        const f = hexOf(theme, fg);
        const b = hexOf(theme, bg);
        const r = f && b ? ratio(f, b) : 0;
        check(
          `${theme}: ${fg} on ${bg} clears 4.5:1`,
          r >= 4.5,
          `${f || "?"} on ${b || "?"} = ${r.toFixed(2)}`
        );
      }
    }

    /* 6d. The scale exists and is used, rather than being retyped. Six
       sections each had their own copy of the heading markup, in four
       different accent hues — two of which failed contrast on the dark band. */
    for (const util of [
      "mk-section",
      "mk-h1",
      "mk-h2",
      "mk-lead",
      "mk-eyebrow",
      "mk-press",
      "mk-rise",
      "mk-in",
      "mk-panel",
    ]) {
      check(`.${util} is defined`, new RegExp(`\\.${util}\\s*\\{`).test(css));
    }
    const SECTIONS = ["features", "how-it-works", "packages", "testimonials", "faq"];
    for (const f of SECTIONS) {
      const src = code(`src/components/landing/${f}.tsx`);
      check(`${f} uses the shared SectionHeading`, src.includes("<SectionHeading"));
      check(`${f} does not re-type a heading scale`, !/text-3xl sm:text-4xl/.test(src));
      check(
        `${f} does not re-introduce a hand-tinted eyebrow`,
        !/rounded-full bg-[a-z]+-500\/10[^"]*text-[a-z]+-600/.test(src)
      );
    }
    for (const f of [...SECTIONS, "cta", "trust-badges", "earnings-calculator"]) {
      const src = code(`src/components/landing/${f}.tsx`);
      check(
        `${f} uses the shared vertical rhythm`,
        /mk-section(-tight)?[ "]/.test(src),
        "a hand-typed py-* re-opens the four-different-gaps problem"
      );
    }

    /* 6e. Motion is opt-out-able. */
    const reduced = (
      css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n\}/g) ?? []
    ).join("\n");
    for (const cls of [
      "mk-rise",
      "mk-in",
      "mk-press",
      "mk-ticker",
      "mk-bar",
      "skeleton",
    ]) {
      check(`.${cls} is answered under prefers-reduced-motion`, reduced.includes(cls));
    }

    /* 6f. Tap targets — a real floor on the controls people actually hit. */
    const hero = code("src/components/landing/hero.tsx");
    check(
      "both hero CTAs are at least 56px tall",
      (hero.match(/min-h-14/g) ?? []).length >= 2
    );
    const tabs = code("src/components/dashboard/bottom-tab-bar.tsx");
    check(
      "every bottom tab is at least 56px tall",
      (tabs.match(/min-h-14/g) ?? []).length >= 2
    );
    const empty = code("src/components/user/primitives/empty-state.tsx");
    check(
      "the empty-state action is at least 44px tall in both branches",
      (empty.match(/min-h-11/g) ?? []).length >= 2
    );

    /* 6g. The hero shows the product. A regression here is silent: the page
       still renders, it just goes back to being a wall of claims. */
    check("the hero renders the product mock", hero.includes("<HeroProduct"));
    const mock = code("src/components/landing/hero-product.tsx");
    check(
      "the mock is built from theme tokens, not a pinned screenshot",
      mock.includes("--mk-surface") && !/<img|next\/image/.test(mock)
    );

    /* 6h. No landing section is served ONLY from a stored row.
       getLandingContent() merges SystemSetting rows over the coded defaults
       per section. A section with an empty coded default would render as
       nothing on an install that has never saved it — and every code change to
       it would be invisible on one that has. */
    const sectionKeys = Object.keys(DEFAULT_LANDING_CONTENT) as (keyof typeof DEFAULT_LANDING_CONTENT)[];
    const hollow = sectionKeys.filter((k) => {
      const v = DEFAULT_LANDING_CONTENT[k] as unknown;
      if (!v || typeof v !== "object") return true;
      return Object.keys(v as object).length === 0;
    });
    check(
      `every landing section has a coded fallback (${sectionKeys.length})`,
      hollow.length === 0,
      hollow.join(", ")
    );
    const home = code("src/app/page.tsx");
    const unrendered = sectionKeys.filter(
      (k) => k !== "appearance" && !home.includes(`content.${k}`)
    );
    check(
      "the home page renders every section it has a default for",
      unrendered.length === 0,
      unrendered.join(", ")
    );
  }

  console.log(
    `\n${passed} passed, ${failures.length} failed` +
      (failures.length ? `\n\n${failures.map((f) => `  - ${f}`).join("\n")}\n` : "\n")
  );
  if (failures.length) process.exitCode = 1;
}

main();
