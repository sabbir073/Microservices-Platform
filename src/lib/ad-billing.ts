import { getSetting } from "@/lib/system-settings";

/**
 * Cost billed to an advertiser per ad click, in dollars. Admin-configurable via
 * the `ads.cpcUsd` SystemSetting; defaults to $0.05. Clamped to a sane range so
 * a bad setting can't zero-out or blow up billing.
 */
export async function getAdClickCost(): Promise<number> {
  const raw = await getSetting<number>("ads.cpcUsd", 0.05);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0.05;
  return Math.min(Math.max(n, 0.001), 100);
}
