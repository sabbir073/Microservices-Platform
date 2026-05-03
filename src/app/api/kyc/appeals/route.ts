import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  kycDocumentId: z.string().min(1),
  reason: z.string().min(20).max(2000),
  evidence: z.array(z.string().url()).max(10).optional(),
});

// GET /api/kyc/appeals — list current user's own appeals
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appeals = await prisma.kYCAppeal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Hydrate doc info
  const docIds = [...new Set(appeals.map((a) => a.kycDocumentId))];
  const docs = docIds.length
    ? await prisma.kYCDocument.findMany({
        where: { id: { in: docIds } },
        select: {
          id: true,
          documentType: true,
          rejectionReason: true,
          status: true,
        },
      })
    : [];
  const docById = new Map(docs.map((d) => [d.id, d]));

  return NextResponse.json({
    appeals: appeals.map((a) => ({
      id: a.id,
      kycDocument: docById.get(a.kycDocumentId) ?? null,
      reason: a.reason,
      evidence: a.evidence,
      status: a.status,
      adminNote: a.adminNote,
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

// POST /api/kyc/appeals — submit an appeal for a rejected KYC document
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const v = createSchema.safeParse(body);
  if (!v.success) {
    return NextResponse.json(
      { error: v.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Verify the KYC document belongs to this user and is REJECTED
  const doc = await prisma.kYCDocument.findUnique({
    where: { id: v.data.kycDocumentId },
    select: { id: true, userId: true, status: true },
  });
  if (!doc || doc.userId !== userId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status !== "REJECTED") {
    return NextResponse.json(
      { error: "Only rejected documents can be appealed" },
      { status: 400 }
    );
  }

  // No outstanding pending appeal for the same doc
  const existing = await prisma.kYCAppeal.findFirst({
    where: {
      kycDocumentId: doc.id,
      status: "PENDING",
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending appeal for this document" },
      { status: 400 }
    );
  }

  const appeal = await prisma.kYCAppeal.create({
    data: {
      userId,
      kycDocumentId: doc.id,
      reason: v.data.reason.trim(),
      evidence: v.data.evidence ?? [],
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true,
    appeal: {
      id: appeal.id,
      status: appeal.status,
      createdAt: appeal.createdAt.toISOString(),
    },
  });
}
