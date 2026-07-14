/**
 * Public-profile link builder. Prefers the @username handle (e.g. /u/fahim.sazid)
 * and falls back to the user id for users without a username. Encoding keeps
 * handle-like names clean (dots/underscores/hyphens/alphanumerics pass through)
 * while staying safe for any legacy username.
 *
 *   <Link href={profileHref(user)}>…</Link>
 */
export function profileHref(u: {
  username?: string | null;
  id: string;
}): string {
  return `/u/${encodeURIComponent(u.username || u.id)}`;
}
