/**
 * "Can a stranger with no account read this post?"
 *
 * This is the only answer to that question in the codebase. It lives in a file
 * of its own, with ZERO imports, for two reasons: the rule is small enough that
 * nothing should be able to hide inside it, and a verification script can then
 * import it without dragging a Prisma client along.
 *
 * It is a closed list rather than a filter that removes the obvious cases. A
 * leak here is not a broken feature — it is someone's private post rendered on
 * Facebook's link preview — so the predicate returns FALSE for anything it has
 * not been explicitly taught is safe.
 *
 * ── WHAT `isPublic` MEANS NOW ───────────────────────────────────────────────
 *
 * `Post.isPublic` is the AUDIENCE the author picked in the composer:
 *
 *    true  → Public        — anyone on the internet, no account needed
 *    false → Members only  — signed-in members, the old behaviour
 *
 * It is NOT an in-platform visibility switch any more. Members-only posts are
 * in the feed, on the profile timeline and in the counts exactly like public
 * ones; every in-platform query that used to filter `isPublic: true` had that
 * filter removed when the picker shipped, because leaving it in would have made
 * "Members only" mean "nobody but me".
 *
 * ── WHY THE EPOCH EXISTS ────────────────────────────────────────────────────
 *
 * The column DEFAULTS to true and the old composer hardcoded `isPublic: true`,
 * so EVERY post written before the picker existed reads `true` without anybody
 * having chosen it. `true` therefore cannot mean "the author chose Public" on
 * its own — it means that only on rows written after the picker shipped.
 *
 * So the gate needs a second fact: the instant the picker went live, stored as
 * the system setting `feed.public_audience_epoch`. A post is public only if it
 * was created at or after that instant. Before it, `isPublic` is a default
 * nobody typed; after it, it is an answer somebody gave.
 *
 * The epoch is fail-closed: no epoch, no public posts at all. A missing setting
 * must never be read as "publish everything".
 *
 * (`updatedAt` is NOT usable for this, and it is the obvious trap: it is
 * `@updatedAt`, so every like, comment and view counter increment bumps it.
 * Within a day of shipping, every old post would have "re-consented".)
 *
 * The other conditions, and why each one is load-bearing:
 *
 *  - `isHidden` — an agency moderator soft-hid it. It is out of the logged-in
 *    feed; it must not reappear on a page with no login at all.
 *  - `groupId === null` — group posts are members-only by construction, and an
 *    author inside a group is never offered the picker.
 *  - the author is ACTIVE — a banned or suspended account's posts stop being a
 *    public face of the platform the moment the account does. `UserStatus` has
 *    four values and only one is safe, so this is an equality test against
 *    ACTIVE, not a list of statuses to exclude: a status added later is refused
 *    by default instead of leaking until someone remembers.
 *  - the author row is there at all.
 *
 * Nothing about the *viewer* is consulted, on purpose: this answers only the
 * anonymous case. A logged-in viewer's extra reach (groups they belong to) is
 * /api/feed's job, and it already does it.
 */
export interface PublicPostGateRow {
  isPublic: boolean;
  isHidden: boolean;
  groupId: string | null;
  createdAt: Date | string;
  user: { status: string } | null;
}

/** The setting key holding the ISO instant the audience picker went live. */
export const PUBLIC_AUDIENCE_EPOCH_KEY = "feed.public_audience_epoch";

/**
 * Parse a stored epoch into milliseconds, or null.
 *
 * Anything unparseable is null — i.e. "no epoch" — which the gate reads as
 * "nothing is public". A corrupt setting must fail the same way a missing one
 * does.
 */
export function parseAudienceEpoch(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Did the AUTHOR choose "Public", as opposed to the column defaulting to true?
 *
 * The whole retroactive-publication problem reduces to this one function.
 */
export function authorChosePublic(
  row: { isPublic: boolean; createdAt: Date | string } | null | undefined,
  epochMs: number | null
): boolean {
  if (!row) return false;
  if (row.isPublic !== true) return false;
  if (epochMs === null) return false;
  const created = new Date(row.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return created >= epochMs;
}

export function isPubliclyVisible(
  row: PublicPostGateRow | null | undefined,
  epochMs: number | null
): boolean {
  if (!row) return false;
  if (!authorChosePublic(row, epochMs)) return false;
  if (row.isHidden !== false) return false;
  if (row.groupId !== null) return false;
  const author = row.user;
  if (!author) return false;
  if (author.status !== "ACTIVE") return false;
  return true;
}

/** What to show the author on their own post. */
export type PostAudience = "PUBLIC" | "MEMBERS";

/**
 * The audience label for a post, by the same rule the gate uses.
 *
 * Used for the badge on the post card, so what an author is told matches what
 * a logged-out stranger can actually reach. A pre-epoch post reads "Members
 * only" even though its column says `true`, because that is the truth.
 */
export function postAudience(
  row: { isPublic: boolean; createdAt: Date | string } | null | undefined,
  epochMs: number | null
): PostAudience {
  return authorChosePublic(row, epochMs) ? "PUBLIC" : "MEMBERS";
}
