import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KycSubmitView } from "@/components/user/security/kyc-submit-view";
import { parseDocumentImages } from "@/lib/kyc";

export const dynamic = "force-dynamic";

export default async function KycPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, doc] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true } }),
    prisma.kYCDocument.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const kycStatus = (user?.kycStatus ?? "NOT_SUBMITTED") as
    | "NOT_SUBMITTED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  return (
    <KycSubmitView
      kycStatus={kycStatus}
      document={
        doc
          ? {
              id: doc.id,
              documentType: doc.documentType,
              images: parseDocumentImages(doc.documentUrl),
              status: doc.status as KycDocStatus,
              rejectionReason: doc.rejectionReason,
              createdAt: doc.createdAt.toISOString(),
              reviewedAt: doc.reviewedAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}

type KycDocStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
