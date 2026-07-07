import type { PaymentProvider } from "./provider";
import { sslcommerz } from "./sslcommerz";
import { bkash } from "./bkash";

export type { PaymentProvider } from "./provider";

const PROVIDERS: Record<string, PaymentProvider> = {
  sslcommerz,
  bkash,
};

export function getPaymentProvider(key: string | null | undefined): PaymentProvider | null {
  if (!key) return null;
  return PROVIDERS[key.toLowerCase()] ?? null;
}

/** All providers currently holding valid credentials (for surfacing in the UI). */
export async function getConfiguredProviders(): Promise<
  { key: string; label: string }[]
> {
  const entries = await Promise.all(
    Object.values(PROVIDERS).map(async (p) => ({
      key: p.key,
      label: p.label,
      ok: await p.isConfigured().catch(() => false),
    }))
  );
  return entries.filter((e) => e.ok).map(({ key, label }) => ({ key, label }));
}
