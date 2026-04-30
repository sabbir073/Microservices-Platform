/**
 * Article Task Configuration
 * --------------------------
 * Article tasks ask users to read content at one or more URLs and submit
 * proof of completion (URL, screenshot, and/or a unique key extracted from
 * the article).
 *
 * On submit, ARTICLE submissions go to PENDING status; admin manually
 * approves to credit points. Optionally, admin can set a unique key —
 * users must enter it correctly to pass.
 */

export interface ArticleLink {
  url: string;
  label?: string;
}

export interface ArticleConfig {
  links: ArticleLink[];
  keywords: string[];
  proofRequirements: {
    /** User submits a URL (e.g. share link, comment URL) */
    url: boolean;
    /** User uploads / pastes a screenshot URL */
    screenshot: boolean;
    /** User must find + enter the unique key */
    uniqueKey: boolean;
  };
  /** Expected unique-key value, compared case-insensitive */
  uniqueKey?: string;
  /** Helper shown to user, e.g. "Find the secret word at the end of the article" */
  uniqueKeyHint?: string;
}

export function emptyArticleConfig(): ArticleConfig {
  return {
    links: [{ url: "", label: "" }],
    keywords: [],
    proofRequirements: {
      url: true,
      screenshot: false,
      uniqueKey: false,
    },
    uniqueKey: "",
    uniqueKeyHint: "",
  };
}

export function validateArticleConfig(
  cfg: ArticleConfig
): { ok: boolean; error?: string } {
  const cleanedLinks = cfg.links.filter((l) => l.url.trim());
  if (cleanedLinks.length === 0) {
    return { ok: false, error: "At least one article link is required" };
  }
  for (const link of cleanedLinks) {
    try {
      new URL(link.url);
    } catch {
      return { ok: false, error: `Invalid link URL: ${link.url}` };
    }
  }
  if (cfg.proofRequirements.uniqueKey && !cfg.uniqueKey?.trim()) {
    return {
      ok: false,
      error: "Unique key value is required when 'Unique Key' proof is enabled",
    };
  }
  return { ok: true };
}

/** Compare submitted key with expected, case-insensitive trim */
export function compareUniqueKey(
  submitted: string | null | undefined,
  expected: string | null | undefined
): boolean {
  const a = (submitted ?? "").trim().toLowerCase();
  const b = (expected ?? "").trim().toLowerCase();
  return a !== "" && a === b;
}
