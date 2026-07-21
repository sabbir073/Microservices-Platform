// Server-side fetch of an uploaded KYC image (stored as a public CloudFront/S3
// URL) into bytes/base64 for OCR + face-match. No S3 keys needed — the URL is
// public. Guards size + content type.

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ImagePayload {
  bytes: Uint8Array;
  base64: string;
  mime: string;
}

/** Fetch a remote image URL into bytes + base64. Throws on non-image / too big. */
export async function fetchImage(url: string): Promise<ImagePayload> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const mime = res.headers.get("content-type") ?? "image/jpeg";
  if (!mime.startsWith("image/")) throw new Error("URL is not an image");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("Empty image");
  if (buf.byteLength > MAX_BYTES) throw new Error("Image too large");
  return { bytes: buf, base64: Buffer.from(buf).toString("base64"), mime };
}
