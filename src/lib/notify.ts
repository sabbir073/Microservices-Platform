import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";
import { NotificationType } from "@/generated/prisma/client";

let vapidReady: boolean | null = null;

/** Configure web-push VAPID from env once. Returns false if keys are unset. */
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@earngpt.com";
  if (pub && priv) {
    try {
      webpush.setVapidDetails(subject, pub, priv);
      vapidReady = true;
    } catch {
      vapidReady = false;
    }
  } else {
    vapidReady = false;
  }
  return vapidReady;
}

/**
 * Deliver email + web-push for an event whose in-app Notification row is created
 * elsewhere (e.g. inside a Prisma $transaction). Does NOT create a row. Safe to
 * call fire-and-forget after the transaction commits. Never throws.
 */
export async function deliverToUser(opts: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { email: true, emailNotifications: true, pushNotifications: true },
    });
    if (!user) return;
    if (
      user.emailNotifications &&
      user.email &&
      !user.email.endsWith("@deleted.local")
    ) {
      sendNotificationEmail(user.email, opts.title, opts.message, opts.link).catch(
        () => {}
      );
    }
    if (user.pushNotifications && ensureVapid()) {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId: opts.userId },
      });
      const payload = JSON.stringify({
        title: opts.title,
        body: opts.message,
        url: opts.link ?? "/",
      });
      await Promise.all(
        subs.map((s) =>
          webpush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload
            )
            .catch(async (err: { statusCode?: number }) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await prisma.pushSubscription
                  .delete({ where: { id: s.id } })
                  .catch(() => {});
              }
            })
        )
      );
    }
  } catch {
    // best-effort
  }
}

export interface NotifyOptions {
  userId: string;
  type?: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  /** Deep link opened when the notification is clicked. */
  link?: string;
}

/**
 * Central notification dispatch: (1) always writes the in-app Notification row,
 * (2) sends an email if the user opted in and SMTP is configured, (3) sends a
 * web-push to every registered subscription. Email/push are best-effort and
 * never throw — a delivery failure must not break the triggering action.
 */
export async function notifyUser(opts: NotifyOptions) {
  const { userId, title, message, data, link } = opts;
  const type = opts.type ?? NotificationType.SYSTEM;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? JSON.parse(JSON.stringify({ ...data, link })) : link ? { link } : undefined,
    },
  });

  // Load prefs + email lazily (don't block the row creation on it).
  const user = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { email: true, emailNotifications: true, pushNotifications: true },
    })
    .catch(() => null);

  if (
    user?.emailNotifications &&
    user.email &&
    !user.email.endsWith("@deleted.local")
  ) {
    sendNotificationEmail(user.email, title, message, link).catch(() => {});
  }

  if (user?.pushNotifications && ensureVapid()) {
    const subs = await prisma.pushSubscription
      .findMany({ where: { userId } })
      .catch(() => []);
    const payload = JSON.stringify({ title, body: message, url: link ?? "/" });
    await Promise.all(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          .catch(async (err: { statusCode?: number }) => {
            // Prune dead subscriptions.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await prisma.pushSubscription
                .delete({ where: { id: s.id } })
                .catch(() => {});
            }
          })
      )
    );
  }

  return notification;
}
