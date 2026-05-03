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
  if (!hasPermission(role, "referrals.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Top 1000 referrers
  const referrers = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    orderBy: { referrals: { _count: "desc" } },
    take: 1000,
  });

  const ids = referrers.map((u) => u.id);
  const counts = await Promise.all(
    ids.map((id) => prisma.user.count({ where: { referredById: id } }))
  );
  const earningsList = await Promise.all(
    ids.map((id) =>
      prisma.referralEarning.aggregate({
        where: { userId: id },
        _sum: { amount: true },
      })
    )
  );
  const earningsMap = new Map(
    ids.map((id, i) => [id, earningsList[i]._sum.amount ?? 0])
  );

  const header = [
    "Rank",
    "User ID",
    "Name",
    "Email",
    "Referral Code",
    "Total Referrals",
    "Total Earnings (USD)",
    "Package Tier",
    "Country",
    "Joined At",
  ].join(",");

  const escape = (s: string | null | undefined) => {
    if (s === null || s === undefined) return "";
    const v = String(s).replace(/"/g, '""');
    return /[,"\n]/.test(v) ? `"${v}"` : v;
  };

  const rows = referrers.map((u, i) =>
    [
      i + 1,
      escape(u.id),
      escape(u.name),
      escape(u.email),
      escape(u.referralCode),
      counts[i] ?? 0,
      (earningsMap.get(u.id) ?? 0).toFixed(2),
      escape(u.packageTier),
      escape(u.country),
      u.createdAt.toISOString(),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="referrals_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
