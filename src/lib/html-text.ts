/**
 * Reading text out of an HTML document.
 *
 * Split out of `link-preview.ts` so it can be shared with `link-verify.ts`
 * without dragging `node:dns`/`node:net` along: link-preview does SSRF-guarded
 * fetching and can only run on the server, while the verification rules are
 * edited in the admin's browser. These two functions are pure string work and
 * belong to neither.
 *
 * One decoder and one meta reader, so a link preview and a task verification
 * never disagree about what a page said.
 */

export function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .trim();
}

/** Pull a <meta> content by property/name, tolerating attribute order. */
export function metaContent(html: string, keys: string[]): string {
  for (const key of keys) {
    const attr =
      key.includes(":") && key.startsWith("og:") ? "property" : "(?:property|name)";
    const m =
      html.match(
        new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i")
      ) ??
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`, "i")
      );
    if (m && m[1]) return decodeHtml(m[1]);
  }
  return "";
}
