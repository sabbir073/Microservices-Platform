/**
 * Friendly short codes derived from cuid primary keys.
 *
 * We keep cuid as the actual database PK (so all foreign keys keep working)
 * but derive a short, uppercase, monospaced-friendly code for display in
 * admin tables, exports, and support conversations.
 *
 * The last 6 characters of a cuid carry ~30 bits of entropy from the random
 * suffix, so collisions are vanishingly rare for real-world user counts.
 */

function shortCode(prefix: string, id: string | null | undefined): string {
  if (!id) return `${prefix}-?????`;
  return `${prefix}-${id.slice(-6).toUpperCase()}`;
}

/** e.g. `cmomx00th0004dvhn1rcjs0mx` → `UID-JS0MX` (5 chars after the 6-char slice).
 *  Actually returns the last 6 chars uppercased, e.g. `UID-CJS0MX`. */
export function userDisplayId(id: string | null | undefined): string {
  return shortCode("UID", id);
}

/** Same shape for tasks: `TID-XXXXXX`. */
export function taskDisplayId(id: string | null | undefined): string {
  return shortCode("TID", id);
}

/** Generic helper for other models if you want to mint a display id from any cuid. */
export function makeDisplayId(prefix: string, id: string | null | undefined): string {
  return shortCode(prefix.toUpperCase(), id);
}
