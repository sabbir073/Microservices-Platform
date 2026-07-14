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

  const { id: param } = await params;

  // The route param is a username handle (preferred) OR a raw user id (legacy).
  // Resolve by username first (case-insensitive), then fall back to id.
  const user =
    (await prisma.user.findFirst({
      where: { username: { equals: param, mode: "insensitive" } },
      select: { id: true, username: true },
    })) ??
    (await prisma.user.findUnique({
      where: { id: param },
      select: { id: true, username: true },
    }));

  if (!user) notFound();

  // Canonical: if reached by id (or wrong case) but a username exists, redirect
  // so the address bar always shows /u/<username>.
  if (user.username && param !== user.username) {
    redirect(`/u/${encodeURIComponent(user.username)}`);
  }

  return <PublicProfileView userId={user.id} viewerId={session.user.id} />;
}
