import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Initiate an SSLCommerz hosted-checkout deposit. Creates a PENDING deposit and
 * returns the gateway redirect URL. Degrades to 400 when keys are unset so the
 * UI can fall back to the manual flow. Sibling providers (bKash/Nagad/Stripe)
 * can be added the same way.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD;
  if (!storeId || !storePasswd) {
    return NextResponse.json(
      { error: "Online gateway not configured. Use a manual method." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const tranId = `dep_${session.user.id.slice(0, 8)}_${Date.now()}`;

  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount,
      method: "SSLCOMMERZ",
      status: "PENDING",
      gatewayRef: tranId,
    },
  });

  const sandbox = process.env.SSLCOMMERZ_SANDBOX !== "false";
  const base = sandbox
    ? "https://sandbox.sslcommerz.com"
    : "https://securepay.sslcommerz.com";

  const form = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePasswd,
    total_amount: String(amount),
    currency: "USD",
    tran_id: tranId,
    success_url: `${appUrl}/api/deposits/gateway/callback?status=success`,
    fail_url: `${appUrl}/api/deposits/gateway/callback?status=fail`,
    cancel_url: `${appUrl}/api/deposits/gateway/callback?status=cancel`,
    ipn_url: `${appUrl}/api/deposits/gateway/callback`,
    cus_name: session.user.name ?? "User",
    cus_email: session.user.email ?? "user@example.com",
    cus_phone: "0000000000",
    shipping_method: "NO",
    product_name: "Wallet deposit",
    product_category: "deposit",
    product_profile: "general",
  });

  try {
    const res = await fetch(`${base}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    if (data?.GatewayPageURL) {
      return NextResponse.json({ redirectUrl: data.GatewayPageURL, depositId: deposit.id });
    }
    return NextResponse.json(
      { error: data?.failedreason || "Gateway init failed" },
      { status: 502 }
    );
  } catch {
    return NextResponse.json({ error: "Gateway unreachable" }, { status: 502 });
  }
}
