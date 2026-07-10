import { prisma } from "@/lib/prisma";

export interface UiToggles {
  cookiesPopup: boolean;
  notificationPopup: boolean;
  pwaInstallPrompt: boolean;
}

const KEYS = {
  cookiesPopup: "ui.cookies_popup_enabled",
  notificationPopup: "ui.notification_popup_enabled",
  pwaInstallPrompt: "ui.pwa_install_prompt_enabled",
} as const;

const DEFAULTS: UiToggles = {
  cookiesPopup: true,
  notificationPopup: true,
  pwaInstallPrompt: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  // Settings may be stored as raw booleans or wrapped as { v: boolean }.
  const unwrapped =
    v && typeof v === "object" && "v" in (v as object)
      ? (v as { v: unknown }).v
      : v;
  return typeof unwrapped === "boolean" ? unwrapped : fallback;
}

// In-process memo so the RootLayout (which reads this on every server render)
// doesn't pay a DB/Accelerate round-trip per navigation. Admin changes still
// apply within CACHE_MS.
const CACHE_MS = 60_000;
let _cache: { value: UiToggles; ts: number } | null = null;

/**
 * Read the admin ON/OFF toggles for the site-wide popups (cookie consent,
 * notification permission prompt, PWA install prompt). Each defaults to `true`
 * when unset or the DB is unreachable. Memoized in-process (~60s) and cached at
 * the edge via Accelerate for cold reads.
 */
export async function getUiToggles(): Promise<UiToggles> {
  if (_cache && Date.now() - _cache.ts < CACHE_MS) return _cache.value;
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { category: "ui_toggles" },
      cacheStrategy: { ttl: 60, swr: 120 },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value: UiToggles = {
      cookiesPopup: asBool(map.get(KEYS.cookiesPopup), DEFAULTS.cookiesPopup),
      notificationPopup: asBool(
        map.get(KEYS.notificationPopup),
        DEFAULTS.notificationPopup
      ),
      pwaInstallPrompt: asBool(
        map.get(KEYS.pwaInstallPrompt),
        DEFAULTS.pwaInstallPrompt
      ),
    };
    _cache = { value, ts: Date.now() };
    return value;
  } catch {
    // Cache the fallback briefly too, so a transient DB error doesn't cause a
    // retry storm on every render.
    _cache = { value: DEFAULTS, ts: Date.now() };
    return DEFAULTS;
  }
}
