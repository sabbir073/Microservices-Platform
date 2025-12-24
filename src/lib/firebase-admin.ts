/**
 * Firebase Auth Integration for Phone Verification
 *
 * This module provides Firebase Phone Authentication integration using the REST API.
 * The client-side handles phone verification with Firebase Auth SDK and sends the
 * ID token to the server for verification.
 *
 * Required environment variables:
 * - FIREBASE_PROJECT_ID: Your Firebase project ID
 * - FIREBASE_WEB_API_KEY: Your Firebase Web API key (for verifying tokens via REST)
 *
 * Note: For production use, consider using the firebase-admin SDK installed via npm.
 * This implementation uses REST API to avoid additional dependencies.
 */

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

// Google's public key endpoint for Firebase token verification
const GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Token verification endpoint
const TOKEN_VERIFY_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=`;

interface DecodedToken {
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  phone_number?: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
  };
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(FIREBASE_PROJECT_ID && FIREBASE_WEB_API_KEY);
}

/**
 * Decode a JWT token without verification (for extracting claims)
 */
function decodeJwtPayload(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(decoded) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Verify a Firebase ID token and extract phone number
 * Uses the Firebase REST API to verify the token
 */
export async function verifyPhoneToken(
  idToken: string
): Promise<{ success: boolean; phoneNumber?: string; uid?: string; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, error: "Firebase not configured" };
  }

  try {
    // First, decode the token to get basic info
    const decoded = decodeJwtPayload(idToken);
    if (!decoded) {
      return { success: false, error: "Invalid token format" };
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return { success: false, error: "Token expired" };
    }

    // Check issuer
    if (decoded.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
      return { success: false, error: "Invalid token issuer" };
    }

    // Check audience
    if (decoded.aud !== FIREBASE_PROJECT_ID) {
      return { success: false, error: "Invalid token audience" };
    }

    // Verify the token with Firebase REST API
    const response = await fetch(`${TOKEN_VERIFY_URL}${FIREBASE_WEB_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Firebase token verification failed:", error);
      return { success: false, error: "Token verification failed" };
    }

    const data = await response.json();
    const user = data.users?.[0];

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get phone number from the verified user
    const phoneNumber = user.phoneNumber || decoded.phone_number;

    if (!phoneNumber) {
      return { success: false, error: "No phone number associated with this account" };
    }

    return {
      success: true,
      phoneNumber,
      uid: user.localId || decoded.sub,
    };
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get user info by ID token
 */
export async function getUserInfo(
  idToken: string
): Promise<{
  success: boolean;
  user?: {
    uid: string;
    phoneNumber?: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    photoUrl?: string;
  };
  error?: string;
}> {
  if (!isFirebaseConfigured()) {
    return { success: false, error: "Firebase not configured" };
  }

  try {
    const response = await fetch(`${TOKEN_VERIFY_URL}${FIREBASE_WEB_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to get user info" };
    }

    const data = await response.json();
    const user = data.users?.[0];

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: {
        uid: user.localId,
        phoneNumber: user.phoneNumber,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
      },
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}
