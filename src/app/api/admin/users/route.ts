import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// Create user schema
const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([
    "USER",
    "SUPER_ADMIN",
    "FINANCE_ADMIN",
    "CONTENT_ADMIN",
    "SUPPORT_ADMIN",
    "MARKETING_ADMIN",
    "MODERATOR",
  ]).default("USER"),
  status: z.enum(["ACTIVE", "PENDING_VERIFICATION"]).default("ACTIVE"),
  packageTier: z.enum(["FREE", "BASIC", "STANDARD", "PREMIUM"]).default("FREE"),
  phone: z.string().optional(),
  country: z.string().optional(),
});

// POST /api/admin/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "users.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Only super admin can create admin accounts
    if (data.role !== "USER" && adminRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only super admin can create admin accounts" },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Generate unique referral code
    const referralCode = uuidv4().slice(0, 8).toUpperCase();

    // Create user
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        status: data.status,
        packageTier: data.packageTier,
        phone: data.phone || null,
        country: data.country || null,
        referralCode,
        emailVerified: data.status === "ACTIVE" ? new Date() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        packageTier: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
