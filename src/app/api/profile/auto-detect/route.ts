import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Reads the request edge headers Vercel/CloudFlare set so the client can
// suggest a country (and timezone) on first profile load when those fields
// are still empty. The user always confirms before we save it.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const h = req.headers;
  // Vercel: x-vercel-ip-country / -country-region / -timezone / -latitude / -longitude
  // Cloudflare: cf-ipcountry / cf-timezone
  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country") ??
    null;
  const region =
    h.get("x-vercel-ip-country-region") ??
    h.get("x-region") ??
    null;
  const city =
    h.get("x-vercel-ip-city") ?? h.get("x-city") ?? null;
  const timezone =
    h.get("x-vercel-ip-timezone") ??
    h.get("cf-timezone") ??
    h.get("x-timezone") ??
    null;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  return NextResponse.json({
    country,
    region,
    city,
    timezone,
    ip: ip ? maskIp(ip) : null,
    detected: !!(country || timezone),
  });
}

function maskIp(ip: string): string {
  // Mask last octet for privacy (IPv4) or last group (IPv6)
  if (ip.includes(":")) {
    return ip.split(":").slice(0, -1).concat(["xxxx"]).join(":");
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "xxx";
    return parts.join(".");
  }
  return ip;
}
