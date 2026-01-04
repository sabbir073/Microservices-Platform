import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { z } from "zod";

const adjustBalanceSchema = z.object({
  type: z.enum(["points", "cash"]),
  action: z.enum(["add", "deduct"]),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

// POST /api/admin/users/[id]/balance - Adjust user balance
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "users.adjust_balance")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = adjustBalanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { type, action, amount, reason } = validation.data;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate the adjustment
    const adjustmentAmount = action === "add" ? amount : -amount;

    // For deduction, check if user has enough balance
    if (action === "deduct") {
      if (type === "points" && user.pointsBalance < amount) {
        return NextResponse.json(
          { error: "Insufficient points balance" },
          { status: 400 }
        );
      }
      if (type === "cash" && user.cashBalance < amount) {
        return NextResponse.json(
          { error: "Insufficient cash balance" },
          { status: 400 }
        );
      }
    }

    // Update user balance and create transaction
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          pointsBalance: type === "points"
            ? { increment: adjustmentAmount }
            : undefined,
          cashBalance: type === "cash"
            ? { increment: adjustmentAmount }
            : undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: id,
          type: action === "add" ? "BONUS" : "PENALTY",
          points: type === "points" ? adjustmentAmount : 0,
          amount: type === "cash" ? adjustmentAmount : 0,
          description: reason || `Admin ${action === "add" ? "credit" : "debit"} - ${type}`,
          status: "COMPLETED",
          metadata: {
            adminId: session.user.id,
            adminEmail: session.user.email,
            balanceType: type,
            action,
            originalAmount: amount,
          },
        },
      }),
    ]);

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: id,
        type: "SYSTEM",
        title: action === "add" ? "Balance Added" : "Balance Deducted",
        message: `${amount} ${type === "points" ? "points" : "USD"} has been ${action === "add" ? "added to" : "deducted from"} your account. ${reason ? `Reason: ${reason}` : ""}`,
      },
    });

    return NextResponse.json({
      message: `Balance ${action === "add" ? "added" : "deducted"} successfully`,
      newBalance: type === "points"
        ? updatedUser.pointsBalance
        : updatedUser.cashBalance,
    });
  } catch (error) {
    console.error("Error adjusting balance:", error);
    return NextResponse.json(
      { error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
