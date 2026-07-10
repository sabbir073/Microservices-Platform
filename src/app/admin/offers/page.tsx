import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { Gift } from "lucide-react";
import { OffersClient } from "@/components/admin/offers/offers-client";

export default async function OffersAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as UserRole | undefined;
  if (!hasPermission(role, "offers.view")) redirect("/admin");

  const canManage = hasPermission(role, "offers.manage");
  const offers = await prisma.offer.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, updatedAt: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
          <Gift className="w-6 h-6 text-fuchsia-400" />
          Offer Pages
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Build custom marketing pages (image, video, rich text, buttons) shared
          via a public link.
        </p>
      </div>

      <OffersClient
        initial={offers.map((o) => ({
          ...o,
          updatedAt: o.updatedAt.toISOString(),
        }))}
        canManage={canManage}
      />
    </div>
  );
}
