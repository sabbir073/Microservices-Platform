import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  const myRequest = me
    ? null
    : await prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId: id, userId } },
      });

  // Pending join requests if I'm an admin/owner
  const pendingRequests =
    me && (me.role === "OWNER" || me.role === "ADMIN")
      ? await prisma.groupJoinRequest.findMany({
          where: { groupId: id, status: "PENDING" },
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      avatarUrl: group.avatarUrl,
      bannerUrl: group.bannerUrl,
      memberCount: group.memberCount,
      ownerId: group.ownerId,
      createdAt: group.createdAt,
    },
    myRole: me?.role ?? null,
    isMember: !!me,
    isOwner: group.ownerId === userId,
    hasPendingRequest: !!myRequest,
    pendingRequests: pendingRequests.map((r) => {
      const rec = r as typeof r & {
        user: { id: string; name: string | null; avatar: string | null };
      };
      return {
        id: rec.id,
        userId: rec.user.id,
        userName: rec.user.name,
        userAvatar: rec.user.avatar,
        createdAt: rec.createdAt,
      };
    }),
  });
}
