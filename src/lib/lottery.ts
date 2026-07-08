import { prisma } from "@/lib/prisma";

export interface LotteryWinner {
  position: number;
  ticketId: string;
  userId: string;
  amount: number;
}

export type DrawResult =
  | { ok: true; winners: LotteryWinner[] }
  | { ok: false; reason: "not_found" | "not_active" | "no_tickets" };

/**
 * Draw an ACTIVE lottery: shuffle its tickets, award each prize position to a
 * distinct ticket (crediting the holder's points + a win notification), then
 * mark the lottery COMPLETED with the winners snapshot. Idempotent by status —
 * a COMPLETED/non-active lottery returns `not_active` and is left untouched, so
 * both the admin "draw" action and the auto-draw cron can call this safely.
 */
export async function drawLottery(lotteryId: string): Promise<DrawResult> {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { tickets: true },
  });
  if (!lottery) return { ok: false, reason: "not_found" };
  if (lottery.status !== "ACTIVE") return { ok: false, reason: "not_active" };
  if (lottery.tickets.length === 0) return { ok: false, reason: "no_tickets" };

  const prizes = lottery.prizes as {
    position: number;
    amount: number;
    description: string;
  }[];
  const ticketIds = lottery.tickets.map((t) => t.id);

  // Shuffle tickets for random selection.
  const shuffled = [...ticketIds].sort(() => Math.random() - 0.5);

  const winners: LotteryWinner[] = [];
  const winnerUpdates: Promise<unknown>[] = [];
  const notificationUpdates: Promise<unknown>[] = [];

  for (let i = 0; i < Math.min(prizes.length, shuffled.length); i++) {
    const ticket = lottery.tickets.find((t) => t.id === shuffled[i]);
    if (!ticket) continue;

    winners.push({
      position: prizes[i].position,
      ticketId: ticket.id,
      userId: ticket.userId,
      amount: prizes[i].amount,
    });

    winnerUpdates.push(
      prisma.lotteryTicket.update({
        where: { id: ticket.id },
        data: { isWinner: true, prizeAmount: prizes[i].amount },
      })
    );
    winnerUpdates.push(
      prisma.user.update({
        where: { id: ticket.userId },
        data: { pointsBalance: { increment: prizes[i].amount } },
      })
    );
    notificationUpdates.push(
      prisma.notification.create({
        data: {
          userId: ticket.userId,
          type: "LOTTERY",
          title: `You Won ${prizes[i].description}!`,
          message: `Congratulations! You won ${prizes[i].amount.toLocaleString()} points in the "${lottery.title}" lottery!`,
          data: {
            lotteryId,
            position: prizes[i].position,
            prizeAmount: prizes[i].amount,
          },
        },
      })
    );
  }

  await Promise.all([
    prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: "COMPLETED", winners: winners as unknown as object },
    }),
    ...winnerUpdates,
    ...notificationUpdates,
  ]);

  return { ok: true, winners };
}
