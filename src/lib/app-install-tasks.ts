/**
 * App-install task — admin pastes a Play Store / App Store link (metadata is
 * auto-fetched, then editable); the user installs the app, follows steps and
 * submits a proof screenshot; admin approves → "download counted". Client-safe
 * (no server imports) so both the admin builder and user page can import it.
 */

export interface AppInstallConfig {
  /** Google Play link (https://play.google.com/store/apps/details?id=…). */
  playStoreUrl?: string;
  /** Apple App Store link (https://apps.apple.com/…/id123…). */
  appStoreUrl?: string;
  /** Display name of the app. */
  appName: string;
  /** App icon/logo URL (auto-fetched or uploaded). */
  appLogo?: string;
  /** Short description of the app. */
  description?: string;
  /** Ordered install/verify instructions shown to the user. */
  steps?: string[];
  /** Auto-approve on screenshot submit (else queued for admin review). */
  autoApprove?: boolean;
}

/** True if a value looks like a supported store URL. */
export function isStoreUrl(url: string): boolean {
  return /play\.google\.com\/store\/apps\/details|apps\.apple\.com|itunes\.apple\.com/i.test(
    url
  );
}

/** Which store a URL belongs to (or null). */
export function detectStore(url: string): "play" | "apple" | null {
  if (/play\.google\.com\/store\/apps\/details/i.test(url)) return "play";
  if (/apps\.apple\.com|itunes\.apple\.com/i.test(url)) return "apple";
  return null;
}

/** Validate an admin-authored config. Returns an error string or null. */
export function validateAppInstallConfig(c: unknown): string | null {
  if (!c || typeof c !== "object") return "App-install config is required.";
  const cfg = c as AppInstallConfig;
  if (!cfg.appName || !cfg.appName.trim()) return "App name is required.";
  if (!cfg.playStoreUrl && !cfg.appStoreUrl)
    return "Add at least one store link (Play Store or App Store).";
  for (const u of [cfg.playStoreUrl, cfg.appStoreUrl]) {
    if (u && !/^https?:\/\//i.test(u)) return "Store links must be full URLs.";
  }
  return null;
}

/** Clean a raw config into the stored shape (trim, clamp steps, drop blanks). */
export function normalizeAppInstallConfig(c: AppInstallConfig): AppInstallConfig {
  return {
    playStoreUrl: c.playStoreUrl?.trim() || undefined,
    appStoreUrl: c.appStoreUrl?.trim() || undefined,
    appName: c.appName.trim(),
    appLogo: c.appLogo?.trim() || undefined,
    description: c.description?.trim() || undefined,
    steps: (c.steps ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15),
    autoApprove: !!c.autoApprove,
  };
}

/** Safely read a stored `appInstallConfig` JSON into the typed shape. */
export function parseAppInstallConfig(v: unknown): AppInstallConfig | null {
  if (!v || typeof v !== "object") return null;
  const c = v as AppInstallConfig;
  if (!c.appName) return null;
  return c;
}
