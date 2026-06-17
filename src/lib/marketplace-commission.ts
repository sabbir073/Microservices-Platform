import { prisma } from "@/lib/prisma";

export interface CommissionRatesConfig {
  /** Default commission in basis points (1 bps = 0.01%). */
  default: number;
  /** Per-asset-type overrides keyed by assetType slug. */
  byAssetType?: Record<string, number>;
}

const SETTING_KEY = "marketplace_commission_rates";

export const DEFAULT_COMMISSION: CommissionRatesConfig = {
  default: 500, // 5%
  byAssetType: {},
};

/** Read commission rate config from SystemSetting; falls back to DEFAULT. */
export async function getCommissionConfig(): Promise<CommissionRatesConfig> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY },
  });
  if (!row?.value || typeof row.value !== "object") return DEFAULT_COMMISSION;
  const v = row.value as Partial<CommissionRatesConfig>;
  return {
    default:
      typeof v.default === "number" ? clampBps(v.default) : DEFAULT_COMMISSION.default,
    byAssetType:
      v.byAssetType && typeof v.byAssetType === "object"
        ? Object.fromEntries(
            Object.entries(v.byAssetType).map(([k, n]) => [
              k.toUpperCase(),
              clampBps(Number(n) || 0),
            ])
          )
        : {},
  };
}

/** Resolve the commission rate (bps) to apply for a particular listing.
 *  Precedence:
 *   1. `MarketplaceListing.commissionRateBps` per-listing override
 *   2. `byAssetType[assetType]` from settings
 *   3. `default` from settings (5% if unset) */
export async function resolveCommissionBps(opts: {
  assetType: string | null | undefined;
  perListingOverride: number | null | undefined;
}): Promise<number> {
  if (
    typeof opts.perListingOverride === "number" &&
    opts.perListingOverride >= 0
  ) {
    return clampBps(opts.perListingOverride);
  }
  const cfg = await getCommissionConfig();
  if (opts.assetType) {
    const byType = cfg.byAssetType?.[opts.assetType.toUpperCase()];
    if (typeof byType === "number") return clampBps(byType);
  }
  return clampBps(cfg.default);
}

/** Compute platform fee + seller amount from an accepted price + bps. */
export function splitPrice(amount: number, bps: number) {
  const safeBps = clampBps(bps);
  const fee = Math.round((amount * safeBps) / 10000 * 100) / 100;
  const sellerAmount = Math.round((amount - fee) * 100) / 100;
  return { fee, sellerAmount };
}

function clampBps(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_COMMISSION.default;
  return Math.max(0, Math.min(10000, Math.round(n)));
}

/** Persist a new commission config. Admin-only at the call site. */
export async function saveCommissionConfig(
  cfg: CommissionRatesConfig
): Promise<void> {
  const payload: CommissionRatesConfig = {
    default: clampBps(cfg.default),
    byAssetType: cfg.byAssetType
      ? Object.fromEntries(
          Object.entries(cfg.byAssetType).map(([k, n]) => [
            k.toUpperCase(),
            clampBps(Number(n) || 0),
          ])
        )
      : {},
  };
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      category: "marketplace",
      value: payload as unknown as object,
    },
    update: {
      category: "marketplace",
      value: payload as unknown as object,
    },
  });
}
