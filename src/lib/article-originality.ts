/**
 * Originality checks for written-article submissions.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
 *
 * A buyer who commissions writing is paying for words, and the cheapest way to
 * defraud them is to paste the same text into twenty accounts. That — and only
 * that — is what this detects:
 *
 *   ✔ the SAME text submitted twice to the SAME task, exactly;
 *   ✔ the same text with the whitespace, case and punctuation shuffled;
 *   ✔ heavy near-duplication of another submission on the same task, measured
 *     as word-trigram overlap;
 *   ✔ text shorter than the buyer asked for;
 *   ✔ text that is one paragraph repeated to reach the word count.
 *
 * It is NOT plagiarism detection. It does not search the web, it has no corpus,
 * and it cannot tell you whether an article was copied from a blog, translated,
 * spun, or written by a language model. It cannot even see duplicates across
 * two DIFFERENT tasks — the comparison set is one task's own submissions,
 * deliberately, because that is the set a reviewer can act on and the only one
 * that stays cheap as the platform grows.
 *
 * Everything it produces is a NOTE FOR THE HUMAN REVIEWER, never an automatic
 * rejection, with one exception: the word count, which is an objective fact the
 * buyer stated up front. A similarity score is evidence, not a verdict, and
 * auto-rejecting on it would punish two people who happened to write the same
 * obvious sentence about the same product.
 *
 * No imports, so the verification script can exercise the real functions.
 */

/** A word list: lowercased, punctuation dropped, runs of space collapsed. */
export function articleWords(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    // Keep letters, digits and apostrophes inside words; everything else is a
    // separator. Unicode-aware so a Bangla or Arabic submission is not reduced
    // to zero words and rejected for being "too short".
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** How many words the buyer is actually getting. */
export function articleWordCount(text: string): number {
  return articleWords(text).length;
}

/**
 * A canonical form for exact-duplicate matching.
 *
 * Two submissions that differ only in spacing, capitalisation or punctuation
 * produce the same string, so "same text, retyped" is caught without needing a
 * similarity score at all.
 */
export function articleFingerprint(text: string): string {
  return articleWords(text).join(" ");
}

/** Word trigrams, deduplicated. The unit of comparison for near-duplicates. */
function trigrams(words: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) {
    out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return out;
}

/**
 * Overlap between two texts, 0–100.
 *
 * Containment rather than Jaccard: scored against the SMALLER text, so a short
 * article pasted wholesale into the middle of a long one still scores ~100.
 * Jaccard would dilute that to nothing and let padding defeat the check.
 */
export function articleSimilarity(a: string, b: string): number {
  const ta = trigrams(articleWords(a));
  const tb = trigrams(articleWords(b));
  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  if (smaller.size === 0) return 0;
  let hits = 0;
  for (const g of smaller) if (larger.has(g)) hits++;
  return Math.round((hits / smaller.size) * 100);
}

/**
 * Self-repetition: the share of trigrams that occur more than once.
 *
 * This is the padding check. One paragraph copied four times hits a word count
 * without being four paragraphs of writing, and it does not look like anybody
 * else's submission, so nothing else here would notice it.
 */
export function articleRepetition(text: string): number {
  const words = articleWords(text);
  if (words.length < 6) return 0;
  const seen = new Map<string, number>();
  let total = 0;
  for (let i = 0; i + 2 < words.length; i++) {
    const g = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    seen.set(g, (seen.get(g) ?? 0) + 1);
    total++;
  }
  let repeated = 0;
  for (const n of seen.values()) if (n > 1) repeated += n - 1;
  return total === 0 ? 0 : Math.round((repeated / total) * 100);
}

/** Similarity at or above this is called out to the reviewer. */
export const ARTICLE_SIMILARITY_FLAG = 60;
/** Self-repetition at or above this is called out to the reviewer. */
export const ARTICLE_REPETITION_FLAG = 35;

export interface ArticleOriginality {
  wordCount: number;
  /** Highest overlap with any other submission on this task, 0–100. */
  maxSimilarity: number;
  /** True when an identical (canonicalised) text was already submitted here. */
  exactDuplicate: boolean;
  /** Share of repeated trigrams within this submission, 0–100. */
  repetition: number;
  /** One line for the reviewer's panel. Never a verdict. */
  note: string;
}

/**
 * Score one submission against the other submissions already on this task.
 *
 * `others` is the plain text of the task's existing submissions. The caller
 * bounds how many are loaded — this is a reviewer's aid, not a search engine,
 * and it must not turn one submit into a full-table read.
 */
export function assessArticleOriginality(
  text: string,
  others: string[]
): ArticleOriginality {
  const wordCount = articleWordCount(text);
  const fp = articleFingerprint(text);
  const repetition = articleRepetition(text);

  let maxSimilarity = 0;
  let exactDuplicate = false;
  for (const other of others) {
    if (!other) continue;
    if (articleFingerprint(other) === fp && fp.length > 0) {
      exactDuplicate = true;
      maxSimilarity = 100;
      break;
    }
    const s = articleSimilarity(text, other);
    if (s > maxSimilarity) maxSimilarity = s;
  }

  const parts: string[] = [`${wordCount} words`];
  if (exactDuplicate) {
    parts.push("IDENTICAL to another submission on this task");
  } else if (maxSimilarity >= ARTICLE_SIMILARITY_FLAG) {
    parts.push(`${maxSimilarity}% overlap with another submission on this task`);
  } else if (others.length > 0) {
    parts.push(`${maxSimilarity}% max overlap with the ${others.length} other submission${others.length === 1 ? "" : "s"} checked`);
  } else {
    parts.push("first submission on this task — nothing to compare against");
  }
  if (repetition >= ARTICLE_REPETITION_FLAG) {
    parts.push(`${repetition}% of it repeats itself`);
  }
  parts.push("Not checked against the web — this is duplicate detection within this task only");

  return {
    wordCount,
    maxSimilarity,
    exactDuplicate,
    repetition,
    note: parts.join(" · "),
  };
}
