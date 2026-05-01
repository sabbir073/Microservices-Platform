import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GroupDetailView } from "@/components/user/groups/group-detail-view";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) notFound();

  return (
    <GroupDetailView
      groupId={id}
      currentUserId={session.user.id}
    />
  );
}
