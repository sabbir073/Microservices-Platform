import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@/generated/prisma";

// GET /api/transactions - Get user transaction history
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TransactionType | null;
    const status = searchParams.get("status") as TransactionStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build query
    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    // Fetch transactions
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    // Calculate summary stats from all completed transactions
    const completedTransactions = await prisma.transaction.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      select: { type: true, points: true },
    });

    const summary = {
      totalEarnings: 0,
      totalWithdrawals: 0,
      totalReferrals: 0,
      totalBonuses: 0,
    };

    completedTransactions.forEach((tx) => {
      const points = tx.points || 0;
      switch (tx.type) {
        case "EARNING":
        case "CHECKIN":
          summary.totalEarnings += points;
          break;
        case "WITHDRAWAL":
          summary.totalWithdrawals += Math.abs(points);
          break;
        case "REFERRAL":
          summary.totalReferrals += points;
          break;
        case "BONUS":
        case "LOTTERY_WIN":
          summary.totalBonuses += points;
          break;
      }
    });

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        status: tx.status,
        points: tx.points,
        amount: tx.amount,
        description: tx.description,
        reference: tx.reference,
        createdAt: tx.createdAt,
        // Determine if it's a credit or debit
        isCredit: !["WITHDRAWAL", "PURCHASE", "PENALTY"].includes(tx.type),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
