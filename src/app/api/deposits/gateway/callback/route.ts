import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@/generated/prisma/client";
import { deliverToUser } from "@/lib/notify";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * SSLCommerz success/fail/cancel + IPN callback. On a successful, still-pending
 * deposit it credits the user's cash balance exactly once (status guard) and
 * redirects back to the wallet. Real deployments should additionally call the
 * SSLCommerz validation API with val_id before crediting.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");

  let tranId = "";
  let gatewayStatus = "";
  try {
    const form = await request.formData();
    tranId = String(form.get("tran_id") ?? "");
    gatewayStatus = String(form.get("status") ?? "");
  } catch {
    // IPN may send JSON or query — fall back below
  }
  if (!tranId) tranId = url.searchParams.get("tran_id") ?? "";

  const isSuccess =
    statusParam === "success" || gatewayStatus === "VALID" || gatewayStatus === "VALIDATED";

  if (!tranId) {
    return NextResponse.redirect(`${APP_URL}/wallet?deposit=error`);
  }

  const deposit = await prisma.deposit.findFirst({ where: { gatewayRef: tranId } });
  if (!deposit) {
    return NextResponse.redirect(`${APP_URL}/wallet?deposit=notfound`);
  }

  if (!isSuccess) {
    if (deposit.status === "PENDING") {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: "REJECTED", adminNote: "Gateway payment not completed" },
      });
    }
    return NextResponse.redirect(`${APP_URL}/wallet?deposit=failed`);
  }

  // Credit once.
  if (deposit.status === "PENDING") {
    await prisma.$transaction([
      prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: deposit.userId },
        data: { cashBalance: { increment: deposit.amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: deposit.userId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          points: 0,
          amount: deposit.amount,
          description: "Deposit via SSLCommerz",
          reference: `deposit_${deposit.id}`,
        },
      }),
    ]);
    void deliverToUser({
      userId: deposit.userId,
      title: "Deposit approved",
      message: `$${deposit.amount.toFixed(2)} has been added to your balance.`,
      link: "/wallet",
    });
  }

  return NextResponse.redirect(`${APP_URL}/wallet?deposit=success`);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
