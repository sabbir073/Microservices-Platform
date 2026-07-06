import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Build providers with actual authorize function that uses database
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      otp: { label: "2FA Code", type: "text" },
    },
    async authorize(credentials) {
      const validatedFields = loginSchema.safeParse(credentials);

      if (!validatedFields.success) {
        return null;
      }

      const { email, password } = validatedFields.data;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user || !user.password) {
        return null;
      }

      const passwordsMatch = await bcrypt.compare(password, user.password);

      if (!passwordsMatch) {
        return null;
      }

      // Check if email is verified
      if (!user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      // Check if account is active
      if (user.status === "BANNED" || user.status === "SUSPENDED") {
        throw new Error("ACCOUNT_DISABLED");
      }

      // Enforce 2FA when enabled: require a valid TOTP code.
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const otp =
          typeof credentials?.otp === "string" ? credentials.otp.trim() : "";
        if (!otp) {
          throw new Error("TWO_FACTOR_REQUIRED");
        }
        const valid = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: "base32",
          token: otp,
          window: 2,
        });
        if (!valid) {
          throw new Error("INVALID_2FA");
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar,
        role: user.role,
      };
    },
  }),
];

// Only add Google provider if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  providers,
  events: {
    async signIn({ user }) {
      if (user.id) {
        // Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
});

/**
 * Resilient wrapper around `auth()`. A stale/corrupt session cookie makes
 * Auth.js throw `JWTSessionError: no matching decryption secret` (e.g. after a
 * secret rotation or an @auth/core version bump). Treat that as "signed out"
 * instead of crashing the page — the next successful sign-in overwrites the
 * bad cookie and self-heals.
 */
export async function getSession() {
  try {
    return await auth();
  } catch (error) {
    console.warn("[auth] session decode failed; treating as signed out:", error);
    return null;
  }
}
