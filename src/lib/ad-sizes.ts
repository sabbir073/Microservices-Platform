/**
 * Ad creative size presets (IAB-style) shared by the Ad Manager size selector
 * and the renderers. Client-safe (no imports). `responsive` = full-width,
 * natural aspect (no fixed dimensions). Stored on `Ad.size`; `custom` uses the
 * `Ad.width`/`Ad.height` columns.
 */
export interface AdSize {
  key: string;
  label: string;
  w: number | null;
  h: number | null;
}

export const AD_SIZES: AdSize[] = [
  { key: "responsive", label: "Responsive (full width)", w: null, h: null },
  { key: "leaderboard", label: "Leaderboard — 728×90", w: 728, h: 90 },
  { key: "banner", label: "Banner — 468×60", w: 468, h: 60 },
  { key: "medium", label: "Medium Rectangle — 300×250", w: 300, h: 250 },
  { key: "large_square", label: "Large Square — 336×280", w: 336, h: 280 },
  { key: "square", label: "Square — 250×250", w: 250, h: 250 },
  { key: "skyscraper", label: "Skyscraper — 160×600", w: 160, h: 600 },
  { key: "mobile", label: "Mobile Banner — 320×50", w: 320, h: 50 },
  { key: "story", label: "Story — 1080×1920", w: 1080, h: 1920 },
  { key: "custom", label: "Custom (width × height)", w: null, h: null },
];

const BY_KEY = new Map(AD_SIZES.map((s) => [s.key, s]));

/**
 * Resolve the effective pixel dimensions for an ad. Returns `null` for the
 * responsive/full-width case (renderer should stretch to container width).
 */
export function resolveAdSize(
  size?: string | null,
  width?: number | null,
  height?: number | null
): { w: number; h: number } | null {
  if (size === "custom") {
    if (width && height && width > 0 && height > 0) return { w: width, h: height };
    return null;
  }
  const preset = size ? BY_KEY.get(size) : null;
  if (preset && preset.w && preset.h) return { w: preset.w, h: preset.h };
  return null; // responsive / unknown
}
