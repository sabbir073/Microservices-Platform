import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { ReferralTreeView } from "@/components/admin/referrals/referral-tree-view";

export default async function ReferralTreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "referrals.view")) redirect("/admin");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      referralCode: true,
      packageTier: true,
    },
  });
  if (!user) notFound();

  return <ReferralTreeView userId={user.id} user={user} />;
}
