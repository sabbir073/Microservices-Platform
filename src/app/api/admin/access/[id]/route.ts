import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole, ADMIN_ROLES } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "admins.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const admin = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Check if user is actually an admin
    if (!ADMIN_ROLES.includes(admin.role as UserRole)) {
      return NextResponse.json({ error: "User is not an admin" }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error) {
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "admins.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only SUPER_ADMIN can manage admin roles
    if (adminRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can manage admin roles" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Cannot modify self
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot modify your own role" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role } = body as { role: string };

    // Validate role
    const validRoles = [...ADMIN_ROLES, "USER"];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      admin: updatedUser,
      message: role === "USER"
        ? "Admin access revoked successfully"
        : "Role updated successfully",
    });
  } catch (error) {
    console.error("Error updating admin role:", error);
    return NextResponse.json(
      { error: "Failed to update admin role" },
      { status: 500 }
    );
  }
}
