import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";

// Bulk action schema
const bulkActionSchema = z.object({
  action: z.enum(["ban", "delete", "unban"]),
  ids: z.array(z.string()).min(1).max(500),
  reason: z.string().optional(),
});

// POST /api/admin/users/bulk - Apply a bulk action to selected users
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    const adminId = session.user.id;

    const body = await request.json();
    const validation = bulkActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, ids, reason } = validation.data;

    // Permission check per action
    if (action === "ban" || action === "unban") {
      if (!hasPermission(adminRole, "users.ban")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (action === "delete") {
      if (!hasPermission(adminRole, "users.delete")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Never let admin act on themselves
    const targetIds = ids.filter((id) => id !== adminId);
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "Cannot act on yourself" },
        { status: 400 }
      );
    }

    // Apply the action
    if (action === "ban") {
      await prisma.user.updateMany({
        where: { id: { in: targetIds } },
        data: { status: "BANNED" },
      });
    } else if (action === "unban") {
      await prisma.user.updateMany({
        where: { id: { in: targetIds } },
        data: { status: "ACTIVE" },
      });
    } else if (action === "delete") {
      // Soft delete: mark banned + suspended
      await prisma.user.updateMany({
        where: { id: { in: targetIds } },
        data: { status: "BANNED" },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `BULK_${action.toUpperCase()}`,
        entity: "User",
        newData: { ids: targetIds, reason: reason ?? null, count: targetIds.length },
      },
    });

    return NextResponse.json({
      success: true,
      affected: targetIds.length,
    });
  } catch (error) {
    console.error("Error in bulk user action:", error);
    return NextResponse.json(
      { error: "Failed to apply bulk action" },
      { status: 500 }
    );
  }
}
