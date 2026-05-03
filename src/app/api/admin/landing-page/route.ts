import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { getLandingContent } from "@/lib/landing-content-server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "landing.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = await getLandingContent();
  return NextResponse.json({ content });
}
