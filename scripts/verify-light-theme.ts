/**
 * Light mode, measured — not eyeballed.
 *
 * The app is written dark-first: every component picks a `bg-X text-Y` pair
 * that was chosen while looking at a near-black screen. Light mode is produced
 * by `html[data-theme="light"]` in globals.css, which does two things:
 *
 *   1. it INVERTS the neutral ramp (`--color-gray-50` becomes dark ink,
 *      `--color-gray-950` becomes a light surface), and
 *   2. it patches ~120 individual utility classes with `!important`.
 *
 * Inversion is the hazard. A developer writing `bg-white text-gray-950` is
 * writing "white box, near-black text" — which is exactly right in dark mode,
 * where `gray-950` IS near-black. Flip the ramp and `text-gray-950` becomes
 * `#e5e9f2`: near-white text on a literal white button. Invisible, and no
 * amount of code review catches it, because the class names still read
 * correctly.
 *
 * This file resolves BOTH halves of every pairing through the real cascade —
 * the Tailwind ramp shipped in node_modules, the `@theme` retune, the light
 * variable flip, and the per-class `!important` patches, in that order — and
 * computes the WCAG ratio. It is the check that stops this recurring.
 *
 * Run: npx tsx --tsconfig tsconfig.script.json scripts/verify-light-theme.ts
 * Also imported by scripts/verify-app-shell.ts, which asserts on its counts.
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();

/* ══════════════════════════════════════════════════════════════════════════
   Colour maths
   ══════════════════════════════════════════════════════════════════════════ */

export type Rgb = { r: number; g: number; b: number };

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

export function parseHex(hex: string): Rgb | null {
  const h = hex.replace("#", "").trim();
  const n =
    h.length === 3 || h.length === 4
      ? h
          .slice(0, 3)
          .split("")
          .map((x) => x + x)
          .join("")
      : h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

export const toHex = (c: Rgb) =>
  "#" +
  [c.r, c.g, c.b]
    .map((x) => clamp255(x).toString(16).padStart(2, "0"))
    .join("");

const srgb = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG 2.1 relative luminance. */
export const luminance = (c: Rgb) =>
  0.2126 * srgb(c.r) + 0.7152 * srgb(c.g) + 0.0722 * srgb(c.b);

/**
 * CIE L* — perceptual lightness, 0..100.
 *
 * Contrast ratio answers "can this be read"; it does not answer "do these two
 * surfaces look like two surfaces". Two whites 1 L* apart have a contrast
 * ratio of 1.01 and so does every other invisible pair, which tells you
 * nothing. L* is the scale the light palette's step sizes were chosen on.
 */
export const lstar = (c: Rgb) => {
  const y = luminance(c);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};

/** WCAG 2.1 contrast ratio, 1..21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Composite `fg` at `alpha` over an opaque `bg`. */
export const flatten = (fg: Rgb, alpha: number, bg: Rgb): Rgb => ({
  r: fg.r * alpha + bg.r * (1 - alpha),
  g: fg.g * alpha + bg.g * (1 - alpha),
  b: fg.b * alpha + bg.b * (1 - alpha),
});

/** oklch() → sRGB hex. Tailwind v4 ships its whole ramp in oklch. */
function oklchToRgb(Lp: number, C: number, Hdeg: number): Rgb {
  const h = (Hdeg * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (Lp + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (Lp - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (Lp - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const enc = (x: number) => {
    const v =
      x <= 0.0031308
        ? 12.92 * x
        : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return clamp255(Math.min(1, Math.max(0, v)) * 255);
  };
  return {
    r: enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   The cascade, rebuilt from the files that actually ship
   ══════════════════════════════════════════════════════════════════════════ */

/** Normalised to LF — `core.autocrlf` checks this repo out with CRLF. */
const readFile = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").split("\r\n").join("\n");

/**
 * Every `--name: value` inside every block opened by `selector`.
 *
 * Scanned rather than regexed for the same reason verify-app-shell.ts does it:
 * every block in globals.css is preceded by a banner comment, so anchoring the
 * selector to `^` or `}` matches nothing while reporting success.
 */
function declsIn(css: string, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  let from = 0;
  for (;;) {
    const at = css.indexOf(selector, from);
    if (at < 0) break;
    from = at + selector.length;
    const open = css.slice(from).match(/^\s*\{/);
    if (!open) continue;
    const bodyStart = from + open[0].length;
    const end = css.indexOf("}", bodyStart);
    if (end < 0) continue;
    for (const d of css.slice(bodyStart, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out.set(d[1], d[2].trim());
    }
  }
  return out;
}

export type Theme = "dark" | "light";

export interface ClassOverride {
  /** The utility class as written in the source, e.g. `bg-gray-800/50`. */
  cls: string;
  prop: "color" | "background-color" | "border-color";
  value: string;
  /** Selector had a tag/attribute qualifier (`input.bg-gray-950`, `.a .b`). */
  qualified: boolean;
  selector: string;
}

export interface Cascade {
  /** `--color-*` in dark, after the `@theme` retune. */
  darkVars: Map<string, string>;
  /** `--color-*` in light, after the `html[data-theme="light"]` flip. */
  lightVars: Map<string, string>;
  /** Tailwind's shipped ramp, converted from oklch. */
  tw: Map<string, Rgb>;
  /** Unqualified per-class light overrides, keyed by class name. */
  lightClass: Map<string, Map<string, string>>;
  /**
   * Light overrides written as `[class*="text-amber-"]` — one rule per hue
   * FAMILY rather than per step. A per-step list cannot cover the `/alpha`
   * variants (`text-amber-200\/80` is a different class from `text-amber-200`),
   * so the family selector is the only form that closes the gap; the resolver
   * has to model it or it measures colours the browser never paints.
   */
  lightFamily: { needle: string; prop: string; value: string }[];
  /** Every override rule found in the light block, for the audit table. */
  overrides: ClassOverride[];
  /** bg-* classes that force `text-white` to stay white in light mode. */
  keepsWhite: Set<string>;
  /**
   * Theme-independent `.bg-<hue>-500.text-white { background-color: … }` rules:
   * a bright fill that is restated darker wherever it carries a white label.
   * Keyed by the bg class.
   */
  compoundFill: Map<string, string>;
  css: string;
}

/** Unescape a CSS-escaped class selector: `bg-gray-800\/50` → `bg-gray-800/50`. */
const unescapeClass = (s: string) => s.replace(/\\(.)/g, "$1");

export function loadCascade(): Cascade {
  const css = readFile("src/app/globals.css");

  const tw = new Map<string, Rgb>();
  const twFile = path.join(ROOT, "node_modules/tailwindcss/theme.css");
  if (fs.existsSync(twFile)) {
    const raw = fs.readFileSync(twFile, "utf8");
    for (const m of raw.matchAll(
      /(--color-[a-z]+-\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g
    )) {
      tw.set(m[1], oklchToRgb(Number(m[2]) / 100, Number(m[3]), Number(m[4])));
    }
  }
  tw.set("--color-white", { r: 255, g: 255, b: 255 });
  tw.set("--color-black", { r: 0, g: 0, b: 0 });

  const darkVars = new Map([...declsIn(css, "@theme"), ...declsIn(css, ":root")]);
  const lightVars = new Map(declsIn(css, 'html[data-theme="light"]'));

  /* Per-class `!important` patches. Strip comments first: the light block is
     heavily commented and a prose mention of `.text-white` must not register
     as a rule. */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lightClass = new Map<string, Map<string, string>>();
  const lightFamily: Cascade["lightFamily"] = [];
  const overrides: ClassOverride[] = [];
  const keepsWhite = new Set<string>();

  const compoundFill = new Map<string, string>();

  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of bare.matchAll(RULE)) {
    const selectorList = m[1];
    if (!selectorList.includes('html[data-theme="light"]')) {
      // Theme-independent bright-fill corrections, e.g.
      //   `.bg-emerald-500.text-white { background-color: #007a55 }`
      const fill = m[2].match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8})/)?.[1];
      if (!fill) continue;
      for (const sel of selectorList.split(",").map((s) => s.trim())) {
        const cm = sel.match(/^\.(bg-[\w-]+)\.text-white$/);
        if (cm) compoundFill.set(cm[1], fill);
      }
      continue;
    }
    const body = m[2];
    const selectors = selectorList
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.includes('html[data-theme="light"]'));

    const props = new Map<string, string>();
    for (const d of body.matchAll(
      /(color|background-color|border-color)\s*:\s*([^;]+);?/g
    )) {
      props.set(d[1], d[2].replace(/!important/, "").trim());
    }
    if (props.size === 0) continue;

    /* `.bg-indigo-600.text-white { color: #fff }` and the `[class*=bg-gradient]`
       variants are the rule that keeps white text white on a saturated fill.
       Record which backgrounds opt in, so the resolver reproduces it instead of
       hard-coding a list that drifts. */
    for (const sel of selectors) {
      const compound = sel.match(/\.([\w\\/-]+)\.text-white\s*$/);
      if (compound && props.get("color")) {
        keepsWhite.add(unescapeClass(compound[1]));
        continue;
      }
      if (/\[class\*="bg-(gradient|linear)"\]\.text-white/.test(sel)) {
        keepsWhite.add(`__${sel.includes("gradient") ? "gradient" : "linear"}__`);
        continue;
      }
      if (/\[class\*="bg-black\/"\]/.test(sel) && props.get("color")) {
        keepsWhite.add("__blackscrim__");
        continue;
      }

      /* A hue-family rule. Both halves of the pair reduce to the same needle:
         `[class^="text-amber-"]` and `[class*=" text-amber-"]` exist to exclude
         variant-prefixed occurrences, which is a distinction the source scan
         already makes for itself (it drops any token containing a colon). The
         `:hover` / `:focus` forms are states, not resting colours, so they are
         deliberately not collected.

         Only the standalone form counts — a descendant selector such as
         `.app-accent [class*="text-"]` is a context rule and is handled by the
         `onDarkSurface` flag, not by the resolver. */
      const fam = sel.match(
        /^html\[data-theme="light"\]\s+\[class(?:\^="|\*=" )([\w-]+-)"\]$/
      );
      if (fam) {
        // The pair of selectors is ONE rule; counting it twice would overstate
        // how much per-class patching the light block still carries, which is
        // the number this audit exists to drive down.
        if (!lightFamily.some((f) => f.needle === fam[1])) {
          for (const [prop, value] of props)
            lightFamily.push({ needle: fam[1], prop, value });
          overrides.push({
            cls: `[class*="${fam[1]}"]`,
            prop: (props.has("color")
              ? "color"
              : "background-color") as ClassOverride["prop"],
            value: [...props.values()][0],
            qualified: false,
            selector: sel,
          });
        }
        continue;
      }

      const tail = sel.replace('html[data-theme="light"]', "").trim();
      // A single, unqualified class: `.text-white`, `.bg-gray-800\/50`.
      const simple = tail.match(/^\.([\w\\/-]+)$/);
      const cls = simple
        ? unescapeClass(simple[1])
        : unescapeClass(tail.match(/\.([\w\\/-]+)/)?.[1] ?? tail);
      for (const [prop, value] of props) {
        overrides.push({
          cls,
          prop: prop as ClassOverride["prop"],
          value,
          qualified: !simple,
          selector: sel,
        });
        if (simple) {
          if (!lightClass.has(cls)) lightClass.set(cls, new Map());
          lightClass.get(cls)!.set(prop, value);
        }
      }
    }
  }

  return {
    darkVars,
    lightVars,
    tw,
    lightClass,
    lightFamily,
    overrides,
    keepsWhite,
    compoundFill,
    css,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Utility class → colour
   ══════════════════════════════════════════════════════════════════════════ */

/** Every hue Tailwind ships, plus the ones `@theme` adds. */
const HUES = new Set([
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose", "brand",
]);

/** `text-sm`, `bg-cover`… — real utilities that are not colours. */
const NOT_A_COLOUR = new Set([
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
  "8xl", "9xl", "left", "right", "center", "justify", "start", "end", "wrap",
  "nowrap", "balance", "pretty", "ellipsis", "clip", "transparent", "current",
  "inherit", "cover", "contain", "none", "auto", "fixed", "local", "scroll",
  "bottom", "top", "repeat", "no", "origin", "gradient", "linear", "radial",
  "conic", "blend", "only",
]);

export interface Resolved {
  hex: string;
  rgb: Rgb;
  /** 0..1. `bg-black/60` → 0.6. */
  alpha: number;
  /** How the value was reached, for the report. */
  via: string;
}

function varToRgb(
  c: Cascade,
  name: string,
  theme: Theme,
  depth = 0
): Rgb | null {
  if (depth > 4) return null;
  const raw = (theme === "light" ? c.lightVars.get(name) : undefined) ?? c.darkVars.get(name);
  if (raw) {
    const hex = raw.match(/#[0-9a-fA-F]{3,8}/)?.[0];
    if (hex) return parseHex(hex);
    const ref = raw.match(/var\((--[\w-]+)\)/)?.[1];
    if (ref) return varToRgb(c, ref, theme, depth + 1);
  }
  return c.tw.get(name) ?? null;
}

/**
 * Resolve one utility class in one theme.
 *
 * Order is the browser's: a per-class `!important` patch in the light block
 * beats the variable, and the variable beats Tailwind's shipped ramp.
 * Returns null for a non-colour utility.
 */
export function resolveUtility(
  c: Cascade,
  cls: string,
  theme: Theme
): (Resolved & { kind: "bg" | "text" }) | null {
  const m = cls.match(/^(bg|text)-(.+)$/);
  if (!m) return null;
  const kind = m[1] as "bg" | "text";
  const rest = m[2];

  // Arbitrary value: bg-[#0b0f19]. No theme handling — it is literal on purpose.
  const arb = rest.match(/^\[(.+)\]$/);
  if (arb) {
    const rgb = parseHex(arb[1]);
    if (!rgb) return null;
    return { kind, hex: toHex(rgb), rgb, alpha: 1, via: "arbitrary" };
  }

  /* A semantic token, `text-(--app-on-accent)` / `bg-(--app-surface-2)`.
     These are the point of the migration, so they have to be measurable — a
     token the audit skips is a token nobody is checking. */
  const tok = rest.match(/^\((--[\w-]+)\)$/);
  if (tok) {
    const rgb = varToRgb(c, tok[1], theme);
    if (!rgb) return null;
    return { kind, hex: toHex(rgb), rgb, alpha: 1, via: tok[1] };
  }

  const [namePart, alphaPart] = rest.split("/");
  const alpha = alphaPart && /^\d+$/.test(alphaPart) ? Number(alphaPart) / 100 : 1;
  const seg = namePart.split("-");
  if (NOT_A_COLOUR.has(seg[0])) return null;

  let token: string | null = null;
  if (namePart === "white") token = "--color-white";
  else if (namePart === "black") token = "--color-black";
  else if (seg.length === 2 && HUES.has(seg[0]) && /^\d{2,3}$/.test(seg[1]))
    token = `--color-${namePart}`;
  else if (seg.length === 1 && HUES.has(seg[0])) token = `--color-${seg[0]}`;
  if (!token) return null;

  const prop = kind === "bg" ? "background-color" : "color";

  if (theme === "light") {
    /* Cascade order inside the light block: an exact per-class patch is more
       specific than a family rule, so it is looked at first. */
    const raw =
      c.lightClass.get(cls)?.get(prop) ??
      c.lightFamily.find((f) => f.prop === prop && cls.includes(f.needle))?.value;
    if (raw) {
      const hex = raw.match(/#[0-9a-fA-F]{3,8}/)?.[0];
      const rgba = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      if (hex) {
        const rgb = parseHex(hex)!;
        return { kind, hex: toHex(rgb), rgb, alpha, via: `!important .${cls}` };
      }
      if (rgba) {
        const rgb = { r: +rgba[1], g: +rgba[2], b: +rgba[3] };
        return {
          kind,
          hex: toHex(rgb),
          rgb,
          alpha: rgba[4] !== undefined ? Number(rgba[4]) : alpha,
          via: `!important .${cls}`,
        };
      }
      const ref = raw.match(/var\((--[\w-]+)\)/)?.[1];
      if (ref) {
        const rgb = varToRgb(c, ref, theme);
        if (rgb) return { kind, hex: toHex(rgb), rgb, alpha, via: `!important .${cls} → ${ref}` };
      }
    }
  }

  const rgb = varToRgb(c, token, theme);
  if (!rgb) return null;
  const flipped =
    theme === "light" && c.lightVars.has(token) ? " (ramp flip)" : "";
  return { kind, hex: toHex(rgb), rgb, alpha, via: `${token}${flipped}` };
}

/* ══════════════════════════════════════════════════════════════════════════
   Source scan — which pairings the app actually ships
   ══════════════════════════════════════════════════════════════════════════ */

export interface Pairing {
  bg: string;
  text: string;
  files: Set<string>;
  count: number;
  /** The literal carries `app-accent` / `on-media`, so white text stays white. */
  onDarkSurface: boolean;
}

function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const e of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, e.name).split("\\").join("/");
    if (e.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

/**
 * The marketing surface is a SEPARATE theme.
 *
 * Landing and `(marketing)` pages render inside `#mk-root`, which is driven by
 * `data-mk-theme` and paints its own `--mk-*` surfaces — a visitor's landing
 * toggle deliberately does not touch their in-app theme. Judging those files
 * against the app's card and page colours measures a pairing the browser never
 * renders, so they are out of scope here and are reported separately.
 */
const MARKETING =
  /^src\/(components\/(landing|marketing)\/|app\/\(marketing\)\/)/;

export const sourceFiles = () =>
  [...walk("src/components"), ...walk("src/app")].filter((f) => !MARKETING.test(f));

export const marketingFiles = () =>
  [...walk("src/components"), ...walk("src/app")].filter((f) => MARKETING.test(f));

/** A class token with a variant prefix (`hover:`, `md:`) — base pairing only. */
const isVariant = (t: string) => t.includes(":");

/**
 * Every `bg-* text-*` pairing written in one class-list literal.
 *
 * Approximate on purpose: a literal is the unit a developer reasons about, and
 * a ternary puts each branch in its own literal, so co-occurrence inside one
 * literal is a good proxy for "these two paint the same element". False
 * positives are cheap (they still have to pass contrast); a missed pairing is
 * the expensive one.
 */
export function collectPairings(files: string[]) {
  const pairings = new Map<string, Pairing>();
  const textOnly = new Map<string, { files: Set<string>; count: number }>();
  const bgOnly = new Map<string, { files: Set<string>; count: number }>();

  for (const f of files) {
    let src: string;
    try {
      src = readFile(f);
    } catch {
      continue;
    }
    // Strip comments so a commented-out class is not audited.
    src = src
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    for (const lit of src.matchAll(/["'`]([^"'`\n]{3,400})["'`]/g)) {
      const body = lit[1];
      if (!/(^|\s)(bg|text)-/.test(body)) continue;
      // Not a class list: a URL, an import path, a sentence with punctuation.
      if (/[<>{};=]/.test(body)) continue;
      const tokens = body.split(/\s+/).filter(Boolean);
      const bgs = tokens.filter((t) => !isVariant(t) && /^bg-/.test(t));
      const texts = tokens.filter((t) => !isVariant(t) && /^text-/.test(t));
      /* `app-accent` and `on-media` mark a ground that is dark in BOTH themes.
         The word boundary has to exclude a longer token: `\b` is satisfied by
         the hyphen in `focus:border-(--app-accent-edge)`, so the plain version
         reported the sidebar's search input as an accent panel and measured
         white-on-white for a field whose text is ink. */
      const onDark =
        /(?:^|[\s"'(])(app-accent|on-media)(?![\w-])/.test(body) ||
        body.includes("bg-(--app-media-well)");

      for (const b of bgs) {
        if (!bgOnly.has(b)) bgOnly.set(b, { files: new Set(), count: 0 });
        const e = bgOnly.get(b)!;
        e.files.add(f);
        e.count++;
      }
      for (const t of texts) {
        if (!textOnly.has(t)) textOnly.set(t, { files: new Set(), count: 0 });
        const e = textOnly.get(t)!;
        e.files.add(f);
        e.count++;
      }
      for (const b of bgs) {
        for (const t of texts) {
          const key = `${b}|${t}|${onDark ? 1 : 0}`;
          if (!pairings.has(key))
            pairings.set(key, {
              bg: b,
              text: t,
              files: new Set(),
              count: 0,
              onDarkSurface: onDark,
            });
          const p = pairings.get(key)!;
          p.files.add(f);
          p.count++;
        }
      }
    }
  }
  return { pairings: [...pairings.values()], textOnly, bgOnly };
}

/* ══════════════════════════════════════════════════════════════════════════
   The audit
   ══════════════════════════════════════════════════════════════════════════ */

export interface Finding {
  kind: "collapse" | "contrast" | "inverted-text" | "inverted-bg";
  theme: Theme;
  label: string;
  ratio: number;
  floor: number;
  files: string[];
  count: number;
  /** Set when the pairing is a KNOWN, reasoned exception — see EXEMPT. */
  exempt?: string;
}

/**
 * Pairings that are under the floor and stay that way, each for a stated
 * reason. An exemption is a decision with a name on it, not a suppression: if
 * one of these stops matching, it drops out of the list and the pairing starts
 * failing again, which is the behaviour you want when someone retunes a ramp.
 *
 * Nothing here is light-mode specific. All of it is dark-mode neutral ramp or
 * third-party brand colour, and both are out of this pass's remit by
 * instruction.
 */
const EXEMPT: { match: RegExp; theme?: Theme; why: string }[] = [
  {
    match: /^text-(gray|slate)-(500|600) on |^text-white on bg-(gray|slate)-(500|600) /,
    theme: "dark",
    why: "dark neutral ramp, measured in an earlier pass and explicitly frozen: 500 clears 5.5:1 and 600 4.3:1 on the CARD, which is the surface they were tuned for. On a nested tile they land at 4.06–4.29. Retuning them is a whole-app change and is out of scope here",
  },
  {
    match: /^text-white on bg-\[#/,
    why: "third-party brand fill (Facebook #1877f2 4.23:1, Telegram #0088cc 3.89:1). The colour is the brand's, not ours; the label is 11px bold beside a 16px logo, and darkening the fill would misrepresent the service",
  },
  {
    match: /^text-\(--app-on-accent\) on bg-\[#/,
    why: "same brand fills, now carrying the semantic token so at least they no longer invert to dark ink in light mode",
  },
  {
    match: /^text-(indigo|blue|purple|violet)-(400|500) on /,
    theme: "dark",
    why: "the accent ramp, which the accent picker remaps per user (19 accents). A value here has to be measured across all 19 rows in src/lib/accent-palette.ts, which is its own pass",
  },
];

/** The three surfaces text lands on, per theme, resolved from the file. */
export function surfaces(c: Cascade) {
  const get = (token: string, theme: Theme) => {
    const rgb = varToRgb(c, token, theme);
    return rgb ?? { r: 0, g: 0, b: 0 };
  };
  return {
    dark: {
      page: get("--color-gray-950", "dark"),
      card: get("--color-gray-900", "dark"),
      tile: get("--color-gray-800", "dark"),
      chrome: get("--shell-bg", "dark"),
    },
    light: {
      page: get("--color-gray-950", "light"),
      card: get("--color-gray-900", "light"),
      tile: get("--color-gray-800", "light"),
      chrome: get("--shell-bg", "light"),
    },
  };
}

/**
 * `text-white` on a saturated fill or a dark-in-both-themes surface must NOT
 * be judged against the light ramp — the CSS deliberately keeps it white.
 */
function whiteStaysWhite(c: Cascade, bg: string, onDark: boolean): boolean {
  if (onDark) return true;
  if (c.keepsWhite.has(bg)) return true;
  if (/^bg-(gradient|linear)/.test(bg)) return true;
  if (c.keepsWhite.has("__blackscrim__") && /^bg-black(\/|$)/.test(bg)) return true;
  return false;
}

/**
 * A per-class `!important` patch that only restates what the variable flip
 * already produces.
 *
 * These are the drift hazard: the same colour written twice, in two places,
 * with nothing keeping them equal. `.text-gray-600` said #616b7d while
 * `--color-gray-600` said #7a8598 — so the same class painted two different
 * colours depending on whether the element also matched some other rule.
 * Anything listed here can be deleted outright.
 */
export function redundantOverrides(c: Cascade) {
  const out: { cls: string; prop: string; value: string; viaVar: string }[] = [];
  for (const [cls, props] of c.lightClass) {
    for (const [prop, value] of props) {
      const patch = value.match(/#[0-9a-fA-F]{3,8}/)?.[0];
      if (!patch) continue;
      const m = cls.match(/^(?:bg|text|border|divide)-([a-z]+-\d{2,3})$/);
      if (!m) continue;
      const viaVar = varToRgb(c, `--color-${m[1]}`, "light");
      if (!viaVar) continue;
      if (toHex(viaVar).toLowerCase() === toHex(parseHex(patch)!).toLowerCase())
        out.push({ cls, prop, value: patch, viaVar: `--color-${m[1]}` });
    }
  }
  return out;
}

/**
 * The opposite hazard: a per-class patch whose value DISAGREES with the
 * variable flip, so one class paints two colours depending on which rule wins.
 */
export function conflictingOverrides(c: Cascade) {
  const out: { cls: string; patch: string; viaVar: string; varName: string }[] = [];
  for (const [cls, props] of c.lightClass) {
    for (const [prop, value] of props) {
      if (prop === "border-color" && !/^border-/.test(cls)) continue;
      const patch = value.match(/#[0-9a-fA-F]{3,8}/)?.[0];
      if (!patch) continue;
      const m = cls.match(/^(?:bg|text|border|divide)-([a-z]+-\d{2,3})$/);
      if (!m) continue;
      // An accent hue deliberately darkens for light mode; that is the point of
      // the patch. Only the NEUTRAL ramp must agree with itself, because the
      // ramp flip is the mechanism there and a second value beside it is a bug.
      if (!/^(gray|slate|zinc|neutral|stone)-/.test(m[1])) continue;
      const viaVar = varToRgb(c, `--color-${m[1]}`, "light");
      if (!viaVar) continue;
      const a = toHex(viaVar).toLowerCase();
      const b = toHex(parseHex(patch)!).toLowerCase();
      if (a !== b)
        out.push({ cls, patch: b, viaVar: a, varName: `--color-${m[1]}` });
    }
  }
  return out;
}

/**
 * The palette table: every surface with its L*, and every ink measured on
 * every surface it can land on, in both themes.
 *
 * This is what "measured" means for a theme — not that somebody looked at it,
 * but that these numbers are recomputed from the stylesheet on every run and
 * the gate fails when one drops under its floor.
 */
export function paletteTable(c: Cascade) {
  const v = (t: string, th: Theme) => varToRgb(c, t, th) ?? { r: 0, g: 0, b: 0 };
  const planes = (th: Theme) => [
    ["page", v("--app-page", th)] as const,
    ["tile / raised", v("--app-surface-2", th)] as const,
    ["chrome", v("--shell-bg", th)] as const,
    ["card", v("--app-surface", th)] as const,
    ["line", v("--app-line", th)] as const,
  ];
  const inks = (th: Theme) => [
    ["ink (primary)", v("--app-ink", th), 4.5] as const,
    ["ink-2 (secondary)", v("--app-ink-2", th), 4.5] as const,
    ["ink-3 (meta)", v("--app-ink-3", th), 4.5] as const,
    ["glyph (non-text)", v("--app-glyph", th), 3] as const,
    ["money in", v("--app-in", th), 4.5] as const,
    ["money out", v("--app-out", th), 4.5] as const,
    ["warning", v("--app-warn", th), 4.5] as const,
    ["brand text", v("--app-info", th), 4.5] as const,
  ];
  return { planes, inks };
}

export function auditLightTheme() {
  const c = loadCascade();
  const surf = surfaces(c);
  const { pairings, textOnly, bgOnly } = collectPairings(sourceFiles());
  const findings: Finding[] = [];

  /* ── 1. Every written `bg-* text-*` pairing, both themes ─────────────── */
  let measured = 0;
  for (const p of pairings) {
    for (const theme of ["dark", "light"] as const) {
      let bg = resolveUtility(c, p.bg, theme);
      let fg = resolveUtility(c, p.text, theme);
      if (!bg || !fg) continue;
      // A bright fill carrying a white label is repainted darker in BOTH
      // themes by the compound rules in globals.css.
      const fixed = p.text === "text-white" ? c.compoundFill.get(p.bg) : undefined;
      if (fixed) {
        const rgb = parseHex(fixed);
        if (rgb) bg = { ...bg, rgb, hex: toHex(rgb), via: `.${p.bg}.text-white` };
      }
      if (theme === "light") {
        // `.app-accent` / `.on-media` force EVERY label inside (or on) them to
        // white, because the ground under them is dark in both themes.
        if (p.onDarkSurface)
          fg = { ...fg, rgb: { r: 255, g: 255, b: 255 }, hex: "#ffffff", alpha: 1 };
        else if (
          p.text.startsWith("text-white") &&
          whiteStaysWhite(c, p.bg, p.onDarkSurface)
        )
          fg = { ...fg, rgb: { r: 255, g: 255, b: 255 }, hex: "#ffffff" };
      }
      /* A translucent fill has to be flattened over SOMETHING, and which
         something matters. A `bg-gray-800/50` panel sits on the page. A
         `bg-black/60` chip does not — it is a scrim, and the only reason to
         paint one is that there is a photo under it. Measuring a scrim against
         the page reports a washed-out mid grey that the app never renders, so
         scrims are flattened over the media well, which is what they sit on
         and which is deliberately dark in both themes. */
      const isScrim = /^bg-black(\/|$)/.test(p.bg) || p.onDarkSurface;
      const base = isScrim
        ? varToRgb(c, "--app-media-well", theme) ?? { r: 13, g: 15, b: 22 }
        : theme === "light"
          ? surf.light.page
          : surf.dark.page;
      const bgFlat = bg.alpha < 1 ? flatten(bg.rgb, bg.alpha, base) : bg.rgb;
      const fgFlat = fg.alpha < 1 ? flatten(fg.rgb, fg.alpha, bgFlat) : fg.rgb;
      const r = contrast(fgFlat, bgFlat);
      measured++;
      if (r < 4.5) {
        findings.push({
          kind: r < 2 ? "collapse" : "contrast",
          theme,
          label: `${p.text} on ${p.bg} (${toHex(fgFlat)} on ${toHex(bgFlat)})`,
          ratio: r,
          floor: 4.5,
          files: [...p.files].slice(0, 4),
          count: p.count,
        });
      }
    }
  }

  /* ── 2. Inverted text tokens ─────────────────────────────────────────────
     A `text-*` class that resolves to a SURFACE colour rather than an ink
     colour. `text-gray-950` means "near-black" to whoever typed it; after the
     ramp flip it is `#e5e9f2`. It will fail on every neutral surface there is,
     whether or not a `bg-` sits beside it in the same literal, so it is judged
     against the lightest surface of its theme rather than against a pairing. */
  for (const [cls, use] of textOnly) {
    /* Ramp steps only. A semantic token (`text-(--app-on-bright)`) names the
       ground it expects, and that ground is deliberately not neutral — judging
       it against the card is how this check would report the fix as the bug.
       Those are measured in the pairing pass above, where the real ground is
       known. */
    if (!/^text-[a-z]+-\d{2,3}(\/\d+)?$/.test(cls)) continue;
    for (const theme of ["dark", "light"] as const) {
      const fg = resolveUtility(c, cls, theme);
      if (!fg || fg.alpha < 0.5) continue;
      const s = theme === "light" ? surf.light : surf.dark;
      // Worst neutral surface for this ink: the one closest in luminance.
      const worst = [s.page, s.card, s.tile].reduce((a, b) =>
        contrast(fg.rgb, a) <= contrast(fg.rgb, b) ? a : b
      );
      const r = contrast(fg.rgb, worst);
      // `text-white` on a coloured fill is legitimate and is covered above.
      if (cls.startsWith("text-white") || cls.startsWith("text-black")) continue;
      if (r < 3) {
        findings.push({
          kind: "inverted-text",
          theme,
          label: `${cls} → ${fg.hex} on neutral ${toHex(worst)}`,
          ratio: r,
          floor: 4.5,
          files: [...use.files].slice(0, 4),
          count: use.count,
        });
      }
    }
  }

  /* ── 3. Inverted background tokens ───────────────────────────────────────
     The mirror image: `bg-gray-100` is a pale chip in dark mode and becomes
     `#131a26` — a near-black block — in light. Judged by whether the surface
     lands on the wrong side of mid-luminance for its theme. */
  for (const [cls, use] of bgOnly) {
    const light = resolveUtility(c, cls, "light");
    const dark = resolveUtility(c, cls, "dark");
    if (!light || !dark || light.alpha < 0.9) continue;
    if (!/^bg-(gray|slate|zinc|neutral|stone|white|black)/.test(cls)) continue;
    const lightIsInk = luminance(light.rgb) < 0.18;
    const darkIsPale = luminance(dark.rgb) > 0.5;
    if (lightIsInk && darkIsPale) {
      findings.push({
        kind: "inverted-bg",
        theme: "light",
        label: `${cls} → ${light.hex} (a near-black block on a light page)`,
        ratio: contrast(light.rgb, surf.light.page),
        floor: 0,
        files: [...use.files].slice(0, 4),
        count: use.count,
      });
    }
  }

  /* ── 4. The palette itself ───────────────────────────────────────────────
     Every ink against every plane it can land on. This is the part that makes
     the theme a theme rather than a shim: the values are chosen so that this
     table has no holes, in both directions, and the gate below fails if one
     opens. A glyph is non-text and answers to 3:1; everything else is body
     text at 4.5:1. */
  const { planes, inks } = paletteTable(c);
  for (const theme of ["dark", "light"] as const) {
    const ps = planes(theme).filter(([n]) => n !== "line");
    for (const [inkName, ink, floor] of inks(theme)) {
      for (const [planeName, plane] of ps) {
        const r = contrast(ink, plane);
        if (r < floor)
          findings.push({
            kind: r < 2 ? "collapse" : "contrast",
            theme,
            label: `${inkName} on ${planeName} (${toHex(ink)} on ${toHex(plane)})`,
            ratio: r,
            floor,
            files: ["src/app/globals.css"],
            count: 0,
          });
      }
    }
  }

  for (const f of findings) {
    const hit = EXEMPT.find(
      (e) => (!e.theme || e.theme === f.theme) && e.match.test(f.label)
    );
    if (hit) f.exempt = hit.why;
  }

  /* ── 5. Surface collisions ──────────────────────────────────────────────
     Not a contrast failure — a DEPTH failure, and the reason a theme can pass
     every ratio and still look wrong.

     `bg-white` means "the brightest thing here", which on a near-black panel it
     is. In light mode the card is also #ffffff, so a white pill laid on a card
     has no edge at all: ratio 1.00, nothing to measure, nothing to see. This
     cannot be fixed in the stylesheet — the call site has to say whether it
     meant "bright" (keep it white, it is on a dark panel) or "raised" (it
     wants the accent fill, or a border). So it is counted and named rather
     than silently patched.

     Reported, never gated: a false positive here is a pill that genuinely does
     sit on a dark panel, and failing the build on one of those would teach
     people to stop running the script. */
  const collisions: {
    cls: string;
    count: number;
    files: string[];
    plane: string;
    dL: number;
  }[] = [];
  /* The classes that ARE the planes. `bg-gray-900` landing on the card is the
     system working, not a collision, and listing those buried the six that
     matter under a thousand that do not. */
  const IS_A_PLANE =
    /^bg-(gray|slate)-(700|800|900|950)(\/\d+)?$|^bg-\(--app-(surface|surface-2|page)\)$/;
  for (const [cls, use] of bgOnly) {
    if (IS_A_PLANE.test(cls)) continue;
    const r = resolveUtility(c, cls, "light");
    if (!r || r.alpha < 0.95) continue;
    /* Measured in L*, not in contrast ratio. Two near-whites have a ratio of
       1.02 and so does every other invisible pair, which ranks nothing; L* is
       the scale the plane scale itself was built on, and 1.2 is roughly half
       its smallest deliberate step (2.40). */
    let best = { plane: "", dL: Infinity };
    for (const [name, plane] of Object.entries(surf.light)) {
      const dL = Math.abs(lstar(r.rgb) - lstar(plane));
      if (dL < best.dL) best = { plane: name, dL };
    }
    if (best.dL < 1.2)
      collisions.push({
        cls,
        count: use.count,
        files: [...use.files].slice(0, 3),
        plane: best.plane,
        dL: best.dL,
      });
  }
  collisions.sort((a, b) => b.count - a.count);

  findings.sort((a, b) => b.count - a.count || a.ratio - b.ratio);
  const live = findings.filter((f) => !f.exempt);
  return {
    cascade: c,
    surfaces: surf,
    pairings,
    findings,
    live,
    collisions,
    measured,
    /** What the gate asserts on: a real failure, not a reasoned exception. */
    hardFailures: live.filter((f) => f.kind !== "contrast" || f.ratio < 3).length,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Report
   ══════════════════════════════════════════════════════════════════════════ */

function main() {
  const { cascade, surfaces: surf, pairings, findings, collisions, measured } =
    auditLightTheme();

  console.log("\n=== Light theme audit ===\n");

  console.log("1. The light block");
  const byClass = new Map<string, ClassOverride[]>();
  for (const o of cascade.overrides) {
    if (!byClass.has(o.cls)) byClass.set(o.cls, []);
    byClass.get(o.cls)!.push(o);
  }
  const rampFlips = [...cascade.lightVars.keys()].filter((k) =>
    k.startsWith("--color-")
  );
  const plain = cascade.overrides.filter((o) => !o.qualified);
  const ctx = cascade.overrides.filter((o) => o.qualified);
  console.log(`   ${cascade.overrides.length} override declarations in total`);
  console.log(
    `     ${plain.length} plain per-class patches, ${new Set(plain.map((o) => o.cls)).size} distinct classes`
  );
  console.log(
    `     ${ctx.length} contextual (a surface that does NOT flip: .app-accent, .on-media, a scrim, a saturated fill)`
  );
  console.log(`   ${byClass.size} distinct classes named anywhere in the block`);
  console.log(`   ${rampFlips.length} ramp variables redefined (the inversion)`);
  console.log(
    `   surfaces  light page ${toHex(surf.light.page)}  card ${toHex(surf.light.card)}  tile ${toHex(surf.light.tile)}`
  );
  console.log(
    `             dark  page ${toHex(surf.dark.page)}  card ${toHex(surf.dark.card)}  tile ${toHex(surf.dark.tile)}`
  );

  const dup = redundantOverrides(cascade);
  const clash = conflictingOverrides(cascade);
  console.log(
    `   ${dup.length} of them only restate the ramp flip (deletable): ${dup
      .map((d) => d.cls)
      .join(", ") || "none"}`
  );
  console.log(`   ${clash.length} DISAGREE with the ramp flip (two colours, one class):`);
  for (const k of clash)
    console.log(`     .${k.cls} says ${k.patch}, ${k.varName} says ${k.viaVar}`);

  console.log("\n2. Pairings");
  console.log(`   ${pairings.length} distinct bg/text pairings written in src/`);
  console.log(`   ${measured} resolved and measured across both themes`);

  console.log("\n3. Findings");
  const groups: Finding["kind"][] = [
    "collapse",
    "inverted-text",
    "inverted-bg",
    "contrast",
  ];
  const TITLES: Record<Finding["kind"], string> = {
    collapse: "COLLAPSED — same-on-same, effectively invisible (< 2:1)",
    "inverted-text": "INVERTED TEXT — a surface colour used as ink",
    "inverted-bg": "INVERTED BACKGROUND — an ink colour used as a surface",
    contrast: "UNDER FLOOR — legible-ish but below 4.5:1",
  };
  for (const g of groups) {
    const rows = findings.filter((f) => f.kind === g && !f.exempt);
    console.log(`\n   ${TITLES[g]}: ${rows.length}`);
    for (const f of rows.slice(0, 25)) {
      console.log(
        `     ${f.theme.padEnd(5)} ${f.ratio.toFixed(2).padStart(5)}:1  x${String(f.count).padStart(3)}  ${f.label}`
      );
      console.log(`            ${f.files.join(", ")}`);
    }
    if (rows.length > 25) console.log(`     … and ${rows.length - 25} more`);
  }

  /* ── The palette, printed ─────────────────────────────────────────────── */
  const { planes, inks } = paletteTable(cascade);
  for (const [n, theme] of [["4a", "light"], ["4b", "dark"]] as const) {
    console.log(`\n${n}. The ${theme} palette`);
    console.log("\n   plane          hex        L*     step");
    /* Ordered by lightness, not by name — the step between two planes is only
       meaningful between neighbours, and the two themes stack their planes in
       opposite orders (a nested tile is lighter than its card in dark and
       darker than it in light, because nothing is lighter than white). */
    const ordered = planes(theme)
      .filter(([n]) => n !== "line")
      .sort((a, b) => lstar(a[1]) - lstar(b[1]));
    let prev: number | null = null;
    for (const [name, rgb] of ordered) {
      const L = lstar(rgb);
      const step = prev === null ? "" : (L - prev).toFixed(2);
      console.log(
        `   ${name.padEnd(14)} ${toHex(rgb)}  ${L.toFixed(2).padStart(6)}  ${step.padStart(6)}`
      );
      prev = L;
    }
    const line = planes(theme).find(([n]) => n === "line")!;
    console.log(
      `   ${"line".padEnd(14)} ${toHex(line[1])}  ${lstar(line[1]).toFixed(2).padStart(6)}`
    );
    const ps = planes(theme).filter(([n]) => n !== "line");
    console.log(
      "\n   ink                floor  " + ps.map(([n]) => n.slice(0, 6).padStart(7)).join("")
    );
    for (const [inkName, ink, floor] of inks(theme)) {
      const cells = ps
        .map(([, plane]) => contrast(ink, plane).toFixed(2).padStart(7))
        .join("");
      console.log(`   ${inkName.padEnd(18)} ${String(floor).padStart(4)}  ${cells}`);
    }
  }

  console.log(
    `\n5. Surface collisions in light mode (depth, not contrast — advisory)`
  );
  if (collisions.length === 0) console.log("   none");
  for (const k of collisions)
    console.log(
      `   ${k.cls.padEnd(22)} x${String(k.count).padStart(3)}  ` +
        `ΔL* ${k.dL.toFixed(2)} from the ${k.plane}  —  ${k.files.join(", ")}`
    );
  console.log(
    "   A fill within 1.2 L* of a neutral plane has no edge on it. Whether that\n" +
      "   matters depends on what the element sits ON, which only the call site\n" +
      "   knows — a white pill on the accent panel is correct, the same pill on a\n" +
      "   card is invisible. Listed, never gated."
  );

  /* ── The marketing layer, reported but not gated ──────────────────────── */
  {
    const mk = collectPairings(marketingFiles());
    console.log(
      `\n6. Marketing surface (out of scope, reported only): ` +
        `${mk.pairings.length} pairings in ${marketingFiles().length} files`
    );
    console.log(
      "   These render inside #mk-root under `data-mk-theme` and paint their own\n" +
        "   --mk-* surfaces, so the app's page/card colours are the wrong ruler for\n" +
        "   them. They need their own pass with the --mk-* planes as the backdrop."
    );
  }

  const waived = findings.filter((f) => f.exempt);
  console.log(`\n7. Reasoned exceptions: ${waived.length}`);
  const byReason = new Map<string, Finding[]>();
  for (const f of waived) {
    if (!byReason.has(f.exempt!)) byReason.set(f.exempt!, []);
    byReason.get(f.exempt!)!.push(f);
  }
  for (const [why, rows] of byReason) {
    console.log(`\n   ${rows.length} pairing(s) — ${why}`);
    for (const f of rows.slice(0, 6))
      console.log(
        `     ${f.theme.padEnd(5)} ${f.ratio.toFixed(2).padStart(5)}:1  x${String(f.count).padStart(3)}  ${f.label}`
      );
    if (rows.length > 6) console.log(`     … and ${rows.length - 6} more`);
  }

  const hard = findings.filter(
    (f) => !f.exempt && (f.kind !== "contrast" || f.ratio < 3)
  ).length;
  const live = findings.filter((f) => !f.exempt).length;
  console.log(
    `\n${live} live findings, ` +
      `${waived.length} reasoned exceptions (${hard} hard failures)`
  );
  // The house summary line, in the shape every other suite prints.
  //
  // The batch runner decides red or green by looking for "N failed". Without
  // this line a clean run of THIS suite was reported as crashed — which is the
  // worst of both: it looks broken every time, and a real failure would be
  // indistinguishable from the noise it had been making all along.
  console.log(
    `\n${pairings.length - live} passed, ${hard} failed` +
      (waived.length ? ` (${waived.length} reasoned exceptions)` : "") +
      "\n"
  );
  if (hard > 0) process.exitCode = 1;
}

if (process.argv[1] && /verify-light-theme\.ts$/.test(process.argv[1])) main();
