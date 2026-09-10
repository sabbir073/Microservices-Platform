import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The work a buyer paid for — READ ONLY.
 *
 * A buyer could see that 10 of 100 people had completed their task and nothing
 * about what those 10 actually did. They are paying for work they cannot look
 * at, which is an odd thing to ask of anyone.
 *
 * There is deliberately no approve, reject, or any other write here. A buyer
 * holding their own credit has every incentive to refuse work that was done
 * properly, and the worker would carry that loss — so judging submissions stays
 * with admins and Smart Auto Verification. This route lets a buyer LOOK.
 *
 * Two things are withheld on purpose:
 *  - **Who did it.** A buyer does not need the worker's identity to check the
 *    work, and handing over a list of everyone who engaged with their brand
 *    invites off-platform contact. The proof is what they bought.
 *  - **Pending submissions.** Showing work before it has been judged invites a
 *    buyer to lobby about it, which is the pressure this split exists to avoid.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Ownership in the query: no request shape reaches another buyer's task.
  const task = await prisma.task.findFirst({
    where: { id, fundedByUserId: session.user.id },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const rows = await prisma.taskSubmission.findMany({
    where: {
      taskId: id,
      // Approved only — see the note above.
      status: { in: ["APPROVED", "AUTO_APPROVED"] },
    },
    orderBy: { reviewedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      proof: true,
      proofImages: true,
      reviewedAt: true,
      createdAt: true,
      pointsEarned: true,
    },
  });

  return NextResponse.json({
    submissions: rows.map((r) => ({
      id: r.id,
      status: String(r.status),
      proof: r.proof ?? null,
      proofImages: r.proofImages ?? [],
      pointsPaid: r.pointsEarned ?? 0,
      at: (r.reviewedAt ?? r.createdAt).toISOString(),
    })),
  });
}
