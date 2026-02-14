import { eq, and } from 'drizzle-orm';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { generateReviewResponse } from '../services/claude/client.js';
import { getNewUnrepliedReviews, replyToReview } from '../services/gbp/reviews.js';
import { starRatingToNumber } from '../services/gbp/types.js';
import { formatReviewAlert } from '../services/whatsapp/templates.js';
import { db } from '../db/client.js';
import { clients, pendingReviews, activityLog } from '../db/schema.js';
import { REVIEW_EXPIRY_HOURS } from '../config/constants.js';
import { createChildLogger } from '../lib/logger.js';
import { sendConfirmationWithMenu } from './menu.js';
import type { InferSelectModel } from 'drizzle-orm';

const log = createChildLogger('review-response');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

/**
 * Poll GBP for new reviews across all active clients.
 * Called by the cron job every 15 minutes.
 */
export async function processNewReviews(): Promise<void> {
  const activeClients = await db
    .select()
    .from(clients)
    .where(eq(clients.status, 'active'));

  log.info({ clientCount: activeClients.length }, 'Polling for new reviews');

  for (const client of activeClients) {
    try {
      await processClientReviews(client);
    } catch (err) {
      log.error(
        { err, clientId: client.id },
        'Failed to process reviews for client',
      );
    }
  }
}

async function processClientReviews(client: Client): Promise<void> {
  // Look back slightly more than the poll interval to avoid missing reviews
  const since = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

  const reviews = await getNewUnrepliedReviews(
    client.id,
    client.gbpAccountId,
    client.gbpLocationId,
    since,
  );

  if (reviews.length === 0) return;

  log.info(
    { clientId: client.id, reviewCount: reviews.length },
    'New reviews found',
  );

  for (const review of reviews) {
    // Skip if already tracked
    const existing = await db
      .select()
      .from(pendingReviews)
      .where(eq(pendingReviews.reviewId, review.name))
      .limit(1);

    if (existing.length > 0) continue;

    const starRating = starRatingToNumber(review.starRating);
    const reviewText = review.comment || '(No comment)';

    // Generate AI response
    const suggestedReply = await generateReviewResponse({
      reviewText,
      starRating,
      reviewerName: review.reviewer.displayName,
      businessName: client.businessName,
      tradeType: client.tradeType,
      county: client.county,
    });

    // Store in pending_reviews
    const expiresAt = new Date(Date.now() + REVIEW_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.insert(pendingReviews).values({
      clientId: client.id,
      reviewId: review.name,
      reviewerName: review.reviewer.displayName,
      reviewText,
      starRating,
      suggestedReply,
      status: 'pending',
      expiresAt,
    });

    // Send WhatsApp interactive message with buttons
    const alertBody = formatReviewAlert(
      review.reviewer.displayName,
      starRating,
      reviewText,
      suggestedReply,
    );

    await whatsapp.sendInteractiveButtons(
      client.whatsappNumber,
      alertBody,
      [
        { id: `approve_${review.name}`, title: 'Post Reply' },
        { id: `edit_${review.name}`, title: 'Edit Reply' },
        { id: `skip_${review.name}`, title: 'Skip' },
      ],
    );

    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'review_alert',
      payload: JSON.stringify({
        reviewId: review.name,
        starRating,
        reviewerName: review.reviewer.displayName,
      }),
      status: 'success',
    });

    log.info(
      { clientId: client.id, reviewId: review.name, starRating },
      'Review alert sent to tradesperson',
    );
  }
}

/**
 * Handle a button reply from the tradesperson (approve/edit/skip).
 */
export async function handleApprovalResponse(
  client: Client,
  buttonId: string,
): Promise<void> {
  // Parse the button ID: "approve_{reviewId}", "edit_{reviewId}", "skip_{reviewId}"
  const underscoreIndex = buttonId.indexOf('_');
  if (underscoreIndex === -1) {
    log.warn({ buttonId }, 'Invalid button ID format');
    return;
  }

  const action = buttonId.substring(0, underscoreIndex);
  const reviewId = buttonId.substring(underscoreIndex + 1);

  const pending = await db
    .select()
    .from(pendingReviews)
    .where(eq(pendingReviews.reviewId, reviewId))
    .limit(1)
    .then((r) => r[0]);

  if (!pending) {
    log.warn({ reviewId }, 'No pending review found for button reply');
    await whatsapp.sendTextMessage(
      client.whatsappNumber,
      'This review is no longer pending.',
    );
    return;
  }

  if (pending.status !== 'pending') {
    log.info({ reviewId, status: pending.status }, 'Review already handled');
    return;
  }

  switch (action) {
    case 'approve': {
      await replyToReview(client.id, pending.reviewId, pending.suggestedReply);

      await db
        .update(pendingReviews)
        .set({ status: 'approved' })
        .where(eq(pendingReviews.id, pending.id));

      await db.insert(activityLog).values({
        clientId: client.id,
        type: 'review_responded',
        payload: JSON.stringify({
          reviewId: pending.reviewId,
          replyText: pending.suggestedReply,
          action: 'approved',
        }),
        status: 'success',
      });

      await sendConfirmationWithMenu(
        client,
        client.whatsappNumber,
        'Reply posted to Google!',
      );

      log.info({ clientId: client.id, reviewId }, 'Review reply approved and posted');
      break;
    }

    case 'edit': {
      await db
        .update(pendingReviews)
        .set({ status: 'awaiting_custom_reply' })
        .where(eq(pendingReviews.id, pending.id));

      await whatsapp.sendTextMessage(
        client.whatsappNumber,
        'Type your reply and send it:',
      );

      log.info({ clientId: client.id, reviewId }, 'Awaiting custom reply');
      break;
    }

    case 'skip': {
      await db
        .update(pendingReviews)
        .set({ status: 'rejected' })
        .where(eq(pendingReviews.id, pending.id));

      await sendConfirmationWithMenu(client, client.whatsappNumber, 'Skipped.');

      log.info({ clientId: client.id, reviewId }, 'Review skipped');
      break;
    }

    default:
      log.warn({ action }, 'Unknown button action');
  }
}

/**
 * Handle a custom reply text from a tradesperson who tapped "Edit".
 * Returns true if the message was consumed (was a custom reply), false otherwise.
 */
export async function handleCustomReply(
  client: Client,
  text: string,
): Promise<boolean> {
  const pending = await db
    .select()
    .from(pendingReviews)
    .where(
      and(
        eq(pendingReviews.clientId, client.id),
        eq(pendingReviews.status, 'awaiting_custom_reply'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!pending) return false;

  // Post the custom reply to GBP
  await replyToReview(client.id, pending.reviewId, text);

  await db
    .update(pendingReviews)
    .set({
      status: 'custom_reply',
      customReplyText: text,
    })
    .where(eq(pendingReviews.id, pending.id));

  await db.insert(activityLog).values({
    clientId: client.id,
    type: 'review_responded',
    payload: JSON.stringify({
      reviewId: pending.reviewId,
      replyText: text,
      action: 'custom_reply',
    }),
    status: 'success',
  });

  await sendConfirmationWithMenu(
    client,
    client.whatsappNumber,
    'Your custom reply has been posted!',
  );

  log.info({ clientId: client.id, reviewId: pending.reviewId }, 'Custom reply posted');
  return true;
}

/**
 * Expire pending reviews that have passed their 48-hour window.
 * Called by the hourly cron job.
 */
export async function expirePendingReviews(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(pendingReviews)
    .where(eq(pendingReviews.status, 'pending'));

  let expiredCount = 0;
  for (const review of expired) {
    if (review.expiresAt <= now) {
      await db
        .update(pendingReviews)
        .set({ status: 'expired' })
        .where(eq(pendingReviews.id, review.id));
      expiredCount++;
    }
  }

  // Also expire any stuck "awaiting_custom_reply" reviews
  const awaitingExpired = await db
    .select()
    .from(pendingReviews)
    .where(eq(pendingReviews.status, 'awaiting_custom_reply'));

  for (const review of awaitingExpired) {
    if (review.expiresAt <= now) {
      await db
        .update(pendingReviews)
        .set({ status: 'expired' })
        .where(eq(pendingReviews.id, review.id));
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    log.info({ expiredCount }, 'Expired pending reviews');
  }
}
