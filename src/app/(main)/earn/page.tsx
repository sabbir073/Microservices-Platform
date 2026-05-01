import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EarningHub } from "@/components/user/earn/earning-hub";

export default async function EarnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      avatar: true,
      level: true,
      xp: true,
      pointsBalance: true,
      packageTier: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <EarningHub
      user={{
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        pointsBalance: user.pointsBalance,
        packageTier: user.packageTier,
      }}
    />
  );
}
