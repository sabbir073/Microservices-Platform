import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  KycAppealView,
  type RejectedDoc,
} from "@/components/user/security/kyc-appeal-view";

export default async function KycAppealPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [docs, appeals] = await Promise.all([
    prisma.kYCDocument.findMany({
      where: { userId, status: "REJECTED" },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
    prisma.kYCAppeal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const rejectedDocs: RejectedDoc[] = docs.map((d) => ({
    id: d.id,
    documentType: d.documentType,
    documentUrl: d.documentUrl,
    rejectionReason: d.rejectionReason,
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
  }));

  // Hydrate doc info for appeal history
  const appealDocIds = [...new Set(appeals.map((a) => a.kycDocumentId))];
  const appealDocs = appealDocIds.length
    ? await prisma.kYCDocument.findMany({
        where: { id: { in: appealDocIds } },
        select: {
          id: true,
          documentType: true,
          rejectionReason: true,
          status: true,
        },
      })
    : [];
  const docById = new Map(appealDocs.map((d) => [d.id, d]));

  const initialAppeals = appeals.map((a) => ({
    id: a.id,
    kycDocument: docById.get(a.kycDocumentId) ?? null,
    reason: a.reason,
    evidence: a.evidence,
    status: a.status,
    adminNote: a.adminNote,
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <KycAppealView
      rejectedDocs={rejectedDocs}
      initialAppeals={initialAppeals}
    />
  );
}
