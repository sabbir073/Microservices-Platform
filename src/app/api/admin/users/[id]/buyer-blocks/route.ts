import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { NotificationType, Prisma } from "@/generated/prisma/client";
import { allPlatformKeys, parseBuyerBlocks } from "@/lib/buyer-scope";
import { BUYER_TASK_TYPES } from "@/lib/buyer-task-types";

/**
 * Suspend one task type or one social platform for ONE buyer.
 *
 * The lever this gives an admin is proportionate. A buyer who keeps submitting
 * rubbish Pinterest tasks previously left two options: leave it, or revoke
 * their task creation entirely and lose the customer. Now Pinterest goes and
 * everything else keeps working.
 *
 * The note is required and reaches the buyer. A suspension nobody explains is
 * one that generates a support ticket instead of a correction — and the buyer
 * cannot stop doing the thing if they are not told what it was.
 */
const schema = z.object({
  types: z.array(z.string().max(40)).max(20).optional(),
  platforms: z.array(z.string().max(40)).max(60).optional(),
  note: z.string().max(500).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, "users.edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, buyerBlocks: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Unknown keys are dropped rather than stored: a typo saved here would be a
  // suspension for something that does not exist, invisible and permanent.
  const knownTypes = new Set<string>(BUYER_TASK_TYPES);
  const knownPlatforms = new Set(allPlatformKeys());
  const types = [
    ...new Set(
      (parsed.data.types ?? [])
        .map((t) => t.toUpperCase())
        .filter((t) => knownTypes.has(t))
    ),
  ];
  const platforms = [
    ...new Set(
      (parsed.data.platforms ?? [])
        .map((p) => p.toUpperCase())
        .filter((p) => knownPlatforms.has(p))
    ),
  ];
  const note = (parsed.data.note ?? "").trim();

  if ((types.length > 0 || platforms.length > 0) && note.length < 5) {
    return NextResponse.json(
      {
        error:
          "Give a reason — the buyer sees it, and a suspension nobody explains just becomes a support ticket.",
      },
      { status: 400 }
    );
  }

  const before = parseBuyerBlocks(target.buyerBlocks);
  const cleared = types.length === 0 && platforms.length === 0;

  await prisma.user.update({
    where: { id },
    data: {
      buyerBlocks: cleared
        ? Prisma.JsonNull
        : ({
            types,
            platforms,
            note,
            at: new Date().toISOString(),
          } as Prisma.InputJsonValue),
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: cleared ? "BUYER_UNSUSPENDED" : "BUYER_SUSPENDED",
    entity: "User",
    entityId: id,
    targetUserId: id,
    summary: cleared
      ? "Cleared all buyer suspensions"
      : `Suspended for this buyer: ${[...types, ...platforms].join(", ")} — ${note}`,
    meta: {
      before: { types: before.types, platforms: before.platforms },
      after: { types, platforms },
      note,
    },
  });

  // Tell them. Whatever they were doing, they will keep doing it until
  // somebody says otherwise.
  const changed =
    JSON.stringify([...before.types, ...before.platforms].sort()) !==
    JSON.stringify([...types, ...platforms].sort());
  if (changed) {
    await notifyUser({
      userId: id,
      type: NotificationType.SYSTEM,
      title: cleared ? "Your task options are back" : "Some task options paused",
      message: cleared
        ? "The restrictions on your buyer account have been lifted. Everything is available again."
        : `${[...types, ...platforms].join(", ")} ${types.length + platforms.length === 1 ? "is" : "are"} paused on your account: ${note}`,
      link: "/create-task",
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, types, platforms, note });
}
