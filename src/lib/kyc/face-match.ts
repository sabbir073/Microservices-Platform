import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
} from "@aws-sdk/client-rekognition";

// Selfie ↔ ID face comparison via AWS Rekognition. Reuses the same AWS
// credentials/region already used for S3. Rekognition must be enabled on the
// account. Fails soft: on any error it returns { ok:false } so the caller
// routes to manual review rather than blocking the user.

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

let client: RekognitionClient | null = null;
function getClient(): RekognitionClient | null {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) return null;
  if (!client) {
    client = new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function isFaceMatchConfigured(): boolean {
  return !!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
}

export interface FaceMatchResult {
  ok: boolean; // did the check run successfully
  similarity: number; // 0..100 best match similarity
  faces: number; // faces detected in the selfie (liveness-lite / quality)
  error?: string;
}

/**
 * Compare a selfie to the ID portrait. `similarityThreshold` is the minimum
 * Rekognition similarity to include in matches (we still return the top score).
 */
export async function compareFaces(
  selfie: Uint8Array,
  idImage: Uint8Array,
  similarityThreshold = 80
): Promise<FaceMatchResult> {
  const c = getClient();
  if (!c) return { ok: false, similarity: 0, faces: 0, error: "Rekognition not configured" };
  try {
    // Quality/liveness-lite: how many faces in the selfie (expect exactly 1).
    const det = await c.send(new DetectFacesCommand({ Image: { Bytes: selfie } }));
    const faces = det.FaceDetails?.length ?? 0;

    const cmp = await c.send(
      new CompareFacesCommand({
        SourceImage: { Bytes: selfie },
        TargetImage: { Bytes: idImage },
        SimilarityThreshold: similarityThreshold,
      })
    );
    const best =
      cmp.FaceMatches?.reduce((m, f) => Math.max(m, f.Similarity ?? 0), 0) ?? 0;
    return { ok: true, similarity: best, faces };
  } catch (e) {
    return {
      ok: false,
      similarity: 0,
      faces: 0,
      error: e instanceof Error ? e.message : "Face match failed",
    };
  }
}
