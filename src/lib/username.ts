// Client-safe username helpers (format rules + slug builder). NO server imports
// here so this can be used from client components and server code alike. The
// server-only "make it unique" resolver lives in `src/lib/auth/services.ts`.

/** A URL-safe profile handle: 3-30 of letters, numbers, dot, underscore, hyphen. */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

export function isValidUsername(s: string): boolean {
  return USERNAME_REGEX.test(s);
}

export const USERNAME_RULE_MESSAGE =
  "Username must be 3-30 characters: letters, numbers, dot, underscore or hyphen.";

/**
 * Turn an arbitrary name/email into a valid username *base* (lowercase, only
 * allowed chars, trimmed of leading/trailing punctuation, max 24 so a
 * uniqueness suffix still fits in 30). May be shorter than 3 — callers that
 * need a guaranteed-valid handle should append a suffix (see the server-side
 * unique generator).
 */
export function slugifyUsername(input: string): string {
  const s = (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
  return s.slice(0, 24);
}
