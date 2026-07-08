import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotificationType, LiveClassStatus } from "@/generated/prisma";
import { isCronAuthorized } from "@/lib/cron";

// POST /api/cron/course-live-classes
// 1-hour-before reminder for every enrolled student of a live class.
// Also flips status from UPCOMING → LIVE / ENDED when the scheduled time
// crosses the start / end.
export async function POST(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const reminderWindowStart = new Date(now.getTime() + 55 * 60 * 1000);

    // ── Reminders for classes starting ~1h from now ────────────────────────
    const reminderClasses = await prisma.courseLiveClass.findMany({
      where: {
        status: LiveClassStatus.UPCOMING,
        scheduledAt: { gte: reminderWindowStart, lte: inOneHour },
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    let remindersFired = 0;
    for (const lc of reminderClasses) {
      const enrolled = await prisma.courseEnrollment.findMany({
        where: { courseId: lc.courseId },
        select: { userId: true },
      });
      if (enrolled.length === 0) continue;
      // Skip if we've already fired a reminder for this exact live class
      const already = await prisma.notification.findFirst({
        where: {
          type: NotificationType.COURSE,
          data: { path: ["liveClassId"], equals: lc.id },
        },
        select: { id: true },
      });
      if (already) continue;
      await prisma.notification.createMany({
        data: enrolled.map((e) => ({
          userId: e.userId,
          type: NotificationType.COURSE,
          title: `Live class in 1 hour ⏰`,
          message: `"${lc.title}" for "${lc.course?.title ?? ""}" starts at ${lc.scheduledAt.toUTCString()}.`,
          data: {
            kind: "live-reminder",
            liveClassId: lc.id,
            courseId: lc.courseId,
            meetingUrl: lc.meetingUrl,
          },
        })),
      });
      remindersFired += enrolled.length;
    }

    // ── Status transitions: UPCOMING → LIVE / LIVE → ENDED ────────────────
    const startedRaw = await prisma.courseLiveClass.updateMany({
      where: {
        status: LiveClassStatus.UPCOMING,
        scheduledAt: { lte: now },
      },
      data: { status: LiveClassStatus.LIVE },
    });

    // ENDED: any LIVE whose (scheduledAt + duration) has passed
    const liveOnes = await prisma.courseLiveClass.findMany({
      where: { status: LiveClassStatus.LIVE },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });
    let ended = 0;
    for (const lc of liveOnes) {
      const endAt = new Date(
        lc.scheduledAt.getTime() + lc.durationMinutes * 60 * 1000
      );
      if (endAt <= now) {
        await prisma.courseLiveClass.update({
          where: { id: lc.id },
          data: { status: LiveClassStatus.ENDED },
        });
        ended += 1;
      }
    }

    return NextResponse.json({
      remindersFired,
      started: startedRaw.count,
      ended,
    });
  } catch (error) {
    console.error("Course live-classes cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron issues GET requests — delegate so either verb works.
export const GET = POST;
