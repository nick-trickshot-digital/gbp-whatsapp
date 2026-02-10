import { eq, and, gte } from 'drizzle-orm';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { fetchWeeklyMetrics } from '../services/gbp/performance.js';
import { formatWeeklyDigest } from '../services/whatsapp/templates.js';
import { db } from '../db/client.js';
import { clients, activityLog } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('weekly-digest');

const whatsapp = new WhatsAppService();

/**
 * Send weekly performance digests to all active clients.
 * Called by the Monday 8 AM cron job.
 */
export async function sendDigests(): Promise<void> {
  const activeClients = await db
    .select()
    .from(clients)
    .where(eq(clients.status, 'active'));

  log.info({ clientCount: activeClients.length }, 'Sending weekly digests');

  for (const client of activeClients) {
    try {
      await sendClientDigest(client);
    } catch (err) {
      log.error(
        { err, clientId: client.id },
        'Failed to send digest for client',
      );
    }
  }
}

async function sendClientDigest(
  client: typeof clients.$inferSelect,
): Promise<void> {
  // Calculate date range for last week
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  // Fetch GBP performance metrics
  const metrics = await fetchWeeklyMetrics(
    client.id,
    client.gbpLocationId,
    startDate,
    endDate,
  );

  // Get activity summary for the week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const weeklyActivity = await db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.clientId, client.id),
        gte(activityLog.createdAt, weekAgo),
        eq(activityLog.status, 'success'),
      ),
    );

  const photosPosted = weeklyActivity.filter(
    (a) => a.type === 'photo_posted',
  ).length;
  const reviewsResponded = weeklyActivity.filter(
    (a) => a.type === 'review_responded',
  ).length;
  const reviewAlerts = weeklyActivity.filter(
    (a) => a.type === 'review_alert',
  ).length;

  // Format the digest message
  const digestText = formatWeeklyDigest({
    businessName: client.businessName,
    impressions: metrics.impressions,
    websiteClicks: metrics.websiteClicks,
    callClicks: metrics.callClicks,
    directionRequests: metrics.directionRequests,
    newReviews: reviewAlerts,
    photosPosted,
    reviewsResponded,
  });

  // Send via WhatsApp template message (proactive, outside 24h window)
  await whatsapp.sendTemplateMessage(
    client.whatsappNumber,
    'weekly_performance_digest',
    [client.businessName, digestText],
  );

  // Log activity
  await db.insert(activityLog).values({
    clientId: client.id,
    type: 'digest_sent',
    payload: JSON.stringify({
      metrics,
      photosPosted,
      reviewsResponded,
      newReviews: reviewAlerts,
    }),
    status: 'success',
  });

  log.info({ clientId: client.id }, 'Weekly digest sent');
}
