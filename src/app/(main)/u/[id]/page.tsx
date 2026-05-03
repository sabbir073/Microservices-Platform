import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicProfileView } from "@/components/user/profile/public-profile-view";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // Quick existence check (404 fast)
  const exists = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) notFound();

  return <PublicProfileView userId={id} viewerId={session.user.id} />;
}
