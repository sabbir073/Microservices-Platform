import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

// Admin roles that can access /admin routes
// Must match ADMIN_ROLE_STRINGS in @/lib/rbac
const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "CONTENT_ADMIN",
  "SUPPORT_ADMIN",
  "MARKETING_ADMIN",
  "MODERATOR",
] as const;

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Build providers array dynamically
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    // Authorization is handled in the main auth config with database access
    authorize: () => null,
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

// Edge-compatible config (no database operations)
export const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    verifyRequest: "/verify-email",
    newUser: "/dashboard",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public routes that don't require authentication
      const publicRoutes = [
        "/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ];

      // Admin routes that require admin role
      const adminRoutes = ["/admin"];

      const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}?`)
      );

      const isAdminRoute = adminRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      // Public API routes
      const isPublicApiRoute = pathname.startsWith("/api/auth");

      // Allow public routes and API routes
      if (isPublicRoute || isPublicApiRoute) {
        return true;
      }

      // Require authentication for protected routes
      if (!isLoggedIn) {
        return false;
      }

      // Check admin role for admin routes
      if (isAdminRoute) {
        const userRole = auth?.user?.role as string;
        const isAdminUser = ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number]);
        if (!isAdminUser) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }

      // Handle session update
      if (trigger === "update" && session) {
        token.name = session.name;
        token.image = session.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
