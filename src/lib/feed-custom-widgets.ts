/**
 * Admin-created custom sidebar widgets. Stored in SystemSetting
 * `feed.custom_widgets`; their id also appears in `feed.sidebar_widgets` (order
 * + enable) so they position/toggle alongside the built-in widgets.
 *
 *  - kind "promo": a gradient call-to-action card (title, subtitle, link).
 *  - kind "links": a titled card with a list of shortcut links.
 * Client-safe (no imports).
 */
export interface CustomWidgetLink {
  label: string;
  href: string;
}

export interface CustomWidget {
  id: string;
  kind: "promo" | "links";
  title: string;
  subtitle?: string;
  href?: string;
  /** Tailwind gradient classes for a promo card (e.g. "from-indigo-600 to-purple-600"). */
  gradient?: string;
  links?: CustomWidgetLink[];
}

export const GRADIENT_OPTIONS: { key: string; label: string }[] = [
  { key: "from-indigo-600 to-purple-600", label: "Indigo → Purple" },
  { key: "from-emerald-600 to-teal-600", label: "Emerald → Teal" },
  { key: "from-rose-600 to-orange-600", label: "Rose → Orange" },
  { key: "from-sky-600 to-blue-700", label: "Sky → Blue" },
  { key: "from-amber-500 to-pink-600", label: "Amber → Pink" },
  { key: "from-violet-600 to-fuchsia-600", label: "Violet → Fuchsia" },
];

export function normalizeCustomWidgets(raw: unknown): CustomWidget[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomWidget[] = [];
  for (const item of raw) {
    const r = (item ?? {}) as Partial<CustomWidget>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!r.id || typeof r.id !== "string" || !title) continue;
    const kind: CustomWidget["kind"] = r.kind === "links" ? "links" : "promo";
    if (kind === "links") {
      const links = Array.isArray(r.links)
        ? r.links
            .map((l) => ({
              label: typeof l?.label === "string" ? l.label.trim() : "",
              href: typeof l?.href === "string" ? l.href.trim() : "",
            }))
            .filter((l) => l.label && l.href)
        : [];
      out.push({ id: r.id, kind, title, links });
    } else {
      out.push({
        id: r.id,
        kind,
        title,
        subtitle: typeof r.subtitle === "string" ? r.subtitle : undefined,
        href: typeof r.href === "string" ? r.href : undefined,
        gradient:
          typeof r.gradient === "string" && r.gradient
            ? r.gradient
            : "from-indigo-600 to-purple-600",
      });
    }
  }
  return out;
}
