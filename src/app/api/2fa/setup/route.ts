import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { getPlatformName } from "@/lib/system-settings";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.twoFactorEnabled) {
    return NextResponse.json({
      enabled: true,
      message: "2FA already enabled",
    });
  }

  // Admin "Platform Name" (General settings) with the env var as fallback.
  // The name is baked into the authenticator entry at enrolment, so a rename
  // only affects people who set 2FA up afterwards — existing entries keep the
  // label they were created with.
  const appName = await getPlatformName();
  const secretObj = speakeasy.generateSecret({
    name: `${appName}:${user.email}`,
    issuer: appName,
    length: 20,
  });
  const secret = secretObj.base32;
  const otpauth = secretObj.otpauth_url ?? "";
  const qrUrl = await QRCode.toDataURL(otpauth);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  return NextResponse.json({
    enabled: false,
    secret,
    qrUrl,
    otpauth,
  });
}
