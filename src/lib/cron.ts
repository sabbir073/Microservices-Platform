import type { NextRequest } from "next/server";

/**
 * Authorize a scheduled-job request. Cron providers (Vercel Cron, GitHub
 * Actions, external schedulers) call our /api/cron/* endpoints with an
 * `Authorization: Bearer <CRON_SECRET>` header. Returns false when the secret
 * is unset (fail closed) or the header doesn't match, so an unconfigured
 * deployment can't have its crons triggered by strangers.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}
