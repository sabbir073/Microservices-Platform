import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "leaderboards.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.systemSetting.findMany({
    where: { category: "leaderboard_history" },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    cycles: rows.map((r) => r.value),
  });
}
