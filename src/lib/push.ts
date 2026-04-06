import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface PushPayload {
  titel: string;
  bericht: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(gebruikerId: number, payload: PushPayload): Promise<number> {
  // Dynamic import to avoid bundling web-push on the client
  const webpush = await import("web-push");

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    throw new Error("VAPID keys niet geconfigureerd");
  }

  webpush.setVapidDetails(
    "mailto:sem@autronis.com",
    vapidPublic,
    vapidPrivate
  );

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.gebruikerId, gebruikerId))
    .all();

  let sent = 0;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keysP256dh,
        auth: sub.keysAuth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      sent++;
    } catch (error: unknown) {
      // 410 Gone or 404 = subscription expired, remove it
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)).run();
      }
    }
  }

  return sent;
}
