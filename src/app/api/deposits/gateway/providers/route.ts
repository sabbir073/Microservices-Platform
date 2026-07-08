import { NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/payments";

/**
 * Lists the online payment providers that currently have valid credentials, so
 * the deposit UI can show an online-checkout button per provider (and hide them
 * all when nothing is configured, leaving only manual methods).
 */
export async function GET() {
  const providers = await getConfiguredProviders().catch(() => []);
  return NextResponse.json({ providers });
}
