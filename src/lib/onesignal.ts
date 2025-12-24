/**
 * OneSignal Push Notification Service
 *
 * This module provides integration with OneSignal for sending push notifications.
 *
 * Required environment variables:
 * - ONESIGNAL_APP_ID: Your OneSignal App ID
 * - ONESIGNAL_REST_API_KEY: Your OneSignal REST API Key
 */

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1";

interface OneSignalNotification {
  app_id: string;
  contents: { en: string };
  headings?: { en: string };
  data?: Record<string, unknown>;
  url?: string;
  // Targeting
  include_external_user_ids?: string[];
  include_player_ids?: string[];
  included_segments?: string[];
  // iOS specific
  ios_badgeType?: "Increase" | "SetTo" | "None";
  ios_badgeCount?: number;
  // Android specific
  android_channel_id?: string;
  small_icon?: string;
  large_icon?: string;
  // Delivery options
  send_after?: string;
  delayed_option?: "timezone" | "last-active";
  ttl?: number;
  priority?: number;
}

interface OneSignalResponse {
  id?: string;
  recipients?: number;
  external_id?: string;
  errors?: unknown;
}

/**
 * Check if OneSignal is configured
 */
export function isOneSignalConfigured(): boolean {
  return !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);
}

/**
 * Send a push notification to specific users by their external user IDs
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
  url?: string
): Promise<{ success: boolean; recipients?: number; error?: string }> {
  if (!isOneSignalConfigured()) {
    console.warn("OneSignal is not configured. Skipping push notification.");
    return { success: false, error: "OneSignal not configured" };
  }

  if (userIds.length === 0) {
    return { success: false, error: "No user IDs provided" };
  }

  const notification: OneSignalNotification = {
    app_id: ONESIGNAL_APP_ID!,
    include_external_user_ids: userIds,
    headings: { en: title },
    contents: { en: message },
    data,
    url,
  };

  return sendNotification(notification);
}

/**
 * Send a push notification to all subscribed users
 */
export async function sendPushToAll(
  title: string,
  message: string,
  data?: Record<string, unknown>,
  url?: string
): Promise<{ success: boolean; recipients?: number; error?: string }> {
  if (!isOneSignalConfigured()) {
    console.warn("OneSignal is not configured. Skipping push notification.");
    return { success: false, error: "OneSignal not configured" };
  }

  const notification: OneSignalNotification = {
    app_id: ONESIGNAL_APP_ID!,
    included_segments: ["All"],
    headings: { en: title },
    contents: { en: message },
    data,
    url,
  };

  return sendNotification(notification);
}

/**
 * Send a push notification to a specific segment
 */
export async function sendPushToSegment(
  segments: string[],
  title: string,
  message: string,
  data?: Record<string, unknown>,
  url?: string
): Promise<{ success: boolean; recipients?: number; error?: string }> {
  if (!isOneSignalConfigured()) {
    console.warn("OneSignal is not configured. Skipping push notification.");
    return { success: false, error: "OneSignal not configured" };
  }

  const notification: OneSignalNotification = {
    app_id: ONESIGNAL_APP_ID!,
    included_segments: segments,
    headings: { en: title },
    contents: { en: message },
    data,
    url,
  };

  return sendNotification(notification);
}

/**
 * Schedule a push notification for later
 */
export async function schedulePush(
  userIds: string[] | null,
  title: string,
  message: string,
  sendAt: Date,
  data?: Record<string, unknown>
): Promise<{ success: boolean; recipients?: number; notificationId?: string; error?: string }> {
  if (!isOneSignalConfigured()) {
    console.warn("OneSignal is not configured. Skipping push notification.");
    return { success: false, error: "OneSignal not configured" };
  }

  const notification: OneSignalNotification = {
    app_id: ONESIGNAL_APP_ID!,
    headings: { en: title },
    contents: { en: message },
    data,
    send_after: sendAt.toISOString(),
  };

  if (userIds && userIds.length > 0) {
    notification.include_external_user_ids = userIds;
  } else {
    notification.included_segments = ["All"];
  }

  return sendNotification(notification);
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true };
  } catch (error) {
    console.error("Error canceling OneSignal notification:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get notification delivery statistics
 */
export async function getNotificationStats(
  notificationId: string
): Promise<{
  success: boolean;
  data?: {
    successful: number;
    failed: number;
    remaining: number;
    converted: number;
    received: number;
  };
  error?: string;
}> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        successful: data.successful || 0,
        failed: data.failed || 0,
        remaining: data.remaining || 0,
        converted: data.converted || 0,
        received: data.received || 0,
      },
    };
  } catch (error) {
    console.error("Error getting OneSignal notification stats:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Set external user ID for a player (used during user login/registration)
 */
export async function setExternalUserId(
  playerId: string,
  externalUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/players/${playerId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          external_user_id: externalUserId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting OneSignal external user ID:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Internal function to send notification to OneSignal API
 */
async function sendNotification(
  notification: OneSignalNotification
): Promise<{ success: boolean; recipients?: number; notificationId?: string; error?: string }> {
  try {
    const response = await fetch(`${ONESIGNAL_API_URL}/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notification),
    });

    const data: OneSignalResponse = await response.json();

    if (!response.ok || data.errors) {
      console.error("OneSignal API error:", data);
      return { success: false, error: JSON.stringify(data.errors || data) };
    }

    return {
      success: true,
      recipients: data.recipients,
      notificationId: data.id,
    };
  } catch (error) {
    console.error("Error sending OneSignal notification:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create or update OneSignal segments based on user criteria
 */
export async function createSegment(
  name: string,
  filters: Array<{
    field: string;
    relation: string;
    value: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/apps/${ONESIGNAL_APP_ID}/segments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          name,
          filters,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: JSON.stringify(error) };
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating OneSignal segment:", error);
    return { success: false, error: String(error) };
  }
}
