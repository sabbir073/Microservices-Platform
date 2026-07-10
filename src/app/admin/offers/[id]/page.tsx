import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { parseBlocks } from "@/lib/offers";
import { OfferEditor } from "@/components/admin/offers/offer-editor";

export default async function OfferEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "offers.manage")) redirect("/admin");

  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) notFound();

  return (
    <OfferEditor
      offer={{
        id: offer.id,
        slug: offer.slug,
        title: offer.title,
        description: offer.description ?? "",
        thumbnailUrl: offer.thumbnailUrl ?? "",
        bgGradient: offer.bgGradient ?? "",
        status: offer.status,
        blocks: parseBlocks(offer.blocks),
      }}
    />
  );
}
