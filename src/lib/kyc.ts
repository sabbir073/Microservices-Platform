/**
 * Parse a KYCDocument.documentUrl that may hold either a single plain URL or a
 * JSON array of URLs (front/back/selfie). Single-URL rows stay backward
 * compatible; multi-image submissions are stored as a JSON array string.
 */
export function parseDocumentImages(documentUrl: string): string[] {
  const raw = documentUrl?.trim() ?? "";
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((u) => typeof u === "string");
    } catch {
      /* fall through to single-url */
    }
  }
  return raw ? [raw] : [];
}
