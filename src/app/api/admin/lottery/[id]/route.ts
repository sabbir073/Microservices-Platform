import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type UserRole } from "@/lib/rbac";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "settings.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const lottery = await prisma.lottery.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!lottery) {
      return NextResponse.json({ error: "Lottery not found" }, { status: 404 });
    }

    return NextResponse.json({ lottery });
  } catch (error) {
    console.error("Error fetching lottery:", error);
    return NextResponse.json(
      { error: "Failed to fetch lottery" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = session.user.role as UserRole | undefined;
    if (!hasPermission(adminRole, "settings.edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const lottery = await prisma.lottery.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!lottery) {
      return NextResponse.json({ error: "Lottery not found" }, { status: 404 });
    }

    if (action === "activate") {
      if (lottery.status !== "UPCOMING") {
        return NextResponse.json(
          { error: "Only upcoming lotteries can be activated" },
          { status: 400 }
        );
      }

      const updatedLottery = await prisma.lottery.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      return NextResponse.json({
        success: true,
        lottery: updatedLottery,
        message: "Lottery activated successfully",
      });
    }

    if (action === "cancel") {
      if (lottery.status === "COMPLETED" || lottery.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Cannot cancel a completed or already cancelled lottery" },
          { status: 400 }
        );
      }

      // Refund all ticket purchases
      const refundPromises = lottery.tickets.map((ticket) =>
        prisma.user.update({
          where: { id: ticket.userId },
          data: {
            pointsBalance: { increment: lottery.ticketPrice },
          },
        })
      );

      // Create refund notifications
      const notificationPromises = lottery.tickets.map((ticket) =>
        prisma.notification.create({
          data: {
            userId: ticket.userId,
            type: "LOTTERY",
            title: "Lottery Cancelled - Refund",
            message: `The lottery "${lottery.title}" has been cancelled. Your ${lottery.ticketPrice} points have been refunded.`,
            data: {
              lotteryId: id,
              ticketId: ticket.id,
              refundAmount: lottery.ticketPrice,
            },
          },
        })
      );

      // Update lottery status
      await Promise.all([
        prisma.lottery.update({
          where: { id },
          data: { status: "CANCELLED" },
        }),
        ...refundPromises,
        ...notificationPromises,
      ]);

      return NextResponse.json({
        success: true,
        message: `Lottery cancelled. ${lottery.tickets.length} ticket(s) refunded.`,
      });
    }

    if (action === "draw") {
      if (lottery.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Only active lotteries can be drawn" },
          { status: 400 }
        );
      }

      if (lottery.tickets.length === 0) {
        return NextResponse.json(
          { error: "Cannot draw winners with no tickets sold" },
          { status: 400 }
        );
      }

      const prizes = lottery.prizes as { position: number; amount: number; description: string }[];
      const ticketIds = lottery.tickets.map((t) => t.id);

      // Shuffle tickets for random selection
      const shuffled = [...ticketIds].sort(() => Math.random() - 0.5);

      // Select winners for each prize position
      const winners: { position: number; ticketId: string; userId: string; amount: number }[] = [];
      const winnerUpdates: Promise<unknown>[] = [];
      const notificationUpdates: Promise<unknown>[] = [];

      for (let i = 0; i < Math.min(prizes.length, shuffled.length); i++) {
        const ticket = lottery.tickets.find((t) => t.id === shuffled[i]);
        if (ticket) {
          winners.push({
            position: prizes[i].position,
            ticketId: ticket.id,
            userId: ticket.userId,
            amount: prizes[i].amount,
          });

          // Update ticket as winner
          winnerUpdates.push(
            prisma.lotteryTicket.update({
              where: { id: ticket.id },
              data: {
                isWinner: true,
                prizeAmount: prizes[i].amount,
              },
            })
          );

          // Award prize points
          winnerUpdates.push(
            prisma.user.update({
              where: { id: ticket.userId },
              data: {
                pointsBalance: { increment: prizes[i].amount },
              },
            })
          );

          // Create winner notification
          notificationUpdates.push(
            prisma.notification.create({
              data: {
                userId: ticket.userId,
                type: "LOTTERY",
                title: `You Won ${prizes[i].description}!`,
                message: `Congratulations! You won ${prizes[i].amount.toLocaleString()} points in the "${lottery.title}" lottery!`,
                data: {
                  lotteryId: id,
                  position: prizes[i].position,
                  prizeAmount: prizes[i].amount,
                },
              },
            })
          );
        }
      }

      // Update lottery as completed with winners
      await Promise.all([
        prisma.lottery.update({
          where: { id },
          data: {
            status: "COMPLETED",
            winners: winners as unknown as object,
          },
        }),
        ...winnerUpdates,
        ...notificationUpdates,
      ]);

      return NextResponse.json({
        success: true,
        winners,
        message: `Draw completed. ${winners.length} winner(s) selected.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating lottery:", error);
    return NextResponse.json(
      { error: "Failed to update lottery" },
      { status: 500 }
    );
  }
}
