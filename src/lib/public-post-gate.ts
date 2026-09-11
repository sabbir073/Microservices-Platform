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
 * The conditions, and why each one is load-bearing:
 *
 *  - `isPublic` — the post-level switch the composer writes. Note the column
 *    DEFAULTS to true, so this alone is not a decision anybody made.
 *  - `isHidden` — an agency moderator soft-hid it. It is out of the logged-in
 *    feed; it must not reappear on a page with no login at all.
 *  - `groupId === null` — group posts are members-only. Because `isPublic`
 *    defaults to true, EVERY group post has `isPublic === true` and would
 *    otherwise sail straight through. The main feed already forces
 *    `groupId: null` for exactly this reason (see /api/feed); this is the same
 *    rule restated where it is needed rather than imported from a route.
 *  - the author is ACTIVE — a banned or suspended account's posts stop being a
 *    public face of the platform the moment the account does. `UserStatus` has
 *    four values and only one is safe, so this is an equality test against
 *    ACTIVE, not a list of statuses to exclude: a status added later is refused
 *    by default instead of leaking until someone remembers.
 *  - the author row is there at all.
 *
 * Nothing about the *viewer* is consulted, on purpose: this answers only the
 * anonymous case. A logged-in viewer's extra reach (their own private posts,
 * groups they belong to) is /api/feed's job, and it already does it.
 */
export interface PublicPostGateRow {
  isPublic: boolean;
  isHidden: boolean;
  groupId: string | null;
  user: { status: string } | null;
}

export function isPubliclyVisible(
  row: PublicPostGateRow | null | undefined
): boolean {
  if (!row) return false;
  if (row.isPublic !== true) return false;
  if (row.isHidden !== false) return false;
  if (row.groupId !== null) return false;
  const author = row.user;
  if (!author) return false;
  if (author.status !== "ACTIVE") return false;
  return true;
}
