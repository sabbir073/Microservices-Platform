import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/utils";
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
  // JWT-only auth (no database sessions). We deliberately don't use an adapter:
  // the User model uses `avatar` (not `image`) and requires a unique
  // `referralCode`, so we find-or-create the app user ourselves in `jwt`.
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Block banned/suspended users from signing in with Google.
      if (account?.provider === "google" && user?.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { status: true },
        });
        if (
          existing &&
          (existing.status === "BANNED" || existing.status === "SUSPENDED")
        ) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // First sign-in with Google: find the app user by email, or create one
      // (with a unique referralCode) so the rest of the app has a real Prisma
      // user. An existing email/password account with the same email is reused,
      // which links the Google login to it.
      if (account?.provider === "google" && user?.email) {
        const email = user.email.toLowerCase();
        let dbUser = await prisma.user.findUnique({ where: { email } });
        if (!dbUser) {
          let referral = generateReferralCode();
          for (let i = 0; i < 5; i++) {
            const clash = await prisma.user.findUnique({
              where: { referralCode: referral },
            });
            if (!clash) break;
            referral = generateReferralCode();
          }
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name ?? null,
              avatar: typeof user.image === "string" ? user.image : null,
              emailVerified: new Date(), // Google verifies the email
              referralCode: referral,
            },
          });
        }
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.name = dbUser.name;
        token.picture = dbUser.avatar;
      } else if (user) {
        // Credentials sign-in: `user` is already the DB user from authorize().
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }

      if (trigger === "update" && session) {
        const s = session as { name?: string; image?: string };
        if (s.name) token.name = s.name;
        if (s.image) token.picture = s.image;
      }

      return token;
    },
  },
  events: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return;
      await prisma.user
        .updateMany({ where: { email }, data: { lastLoginAt: new Date() } })
        .catch(() => {});
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
