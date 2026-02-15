import { eq, and } from 'drizzle-orm';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { generateOfferPost } from '../services/claude/client.js';
import { createOfferPost } from '../services/gbp/posts.js';
import { db } from '../db/client.js';
import { pendingPosts, activityLog } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';
import { sendConfirmationWithMenu } from './menu.js';
import { OFFER_DEFAULT_DURATION_DAYS } from '../config/constants.js';
import type { clients } from '../db/schema.js';
import type { InferSelectModel } from 'drizzle-orm';

const log = createChildLogger('offer-post');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

/**
 * Generate an offer post suggestion and send it for approval.
 * Triggered when a tradesperson selects "Create an Offer" from the menu.
 */
export async function startOfferPost(
  client: Client,
  prompt: string,
  from: string,
): Promise<void> {
  log.info({ clientId: client.id, prompt }, 'Generating offer post suggestion');

  try {
    const suggestedText = await generateOfferPost({
      prompt,
      tradeType: client.tradeType,
      businessName: client.businessName,
      county: client.county,
      businessContext: {
        summary: client.websiteSummary ?? undefined,
        serviceAreas: client.serviceAreas ?? undefined,
        services: client.services ?? undefined,
      },
    });

    const offerEndDate = new Date();
    offerEndDate.setDate(offerEndDate.getDate() + OFFER_DEFAULT_DURATION_DAYS);

    const [pending] = await db.insert(pendingPosts).values({
      clientId: client.id,
      prompt,
      suggestedText,
      postType: 'offer',
      offerEndDate,
      ctaType: 'CALL',
      status: 'pending',
    }).returning();

    const endDateStr = offerEndDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // WhatsApp interactive body max is 1024 chars — truncate preview if needed
    const maxPreviewLen = 900;
    const previewText = suggestedText.length > maxPreviewLen
      ? suggestedText.slice(0, maxPreviewLen) + '...'
      : suggestedText;

    await whatsapp.sendInteractiveButtons(
      from,
      `Here's your offer post:\n\n"${previewText}"\n\nOffer valid until: ${endDateStr}\nCall-to-action: Call Now`,
      [
        { id: `offer_approve_${pending.id}`, title: 'Post It' },
        { id: `offer_edit_${pending.id}`, title: 'Edit' },
        { id: `offer_skip_${pending.id}`, title: 'Skip' },
      ],
    );

    log.info({ clientId: client.id, pendingId: pending.id }, 'Offer post suggestion sent');
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Failed to generate offer post suggestion');

    await sendConfirmationWithMenu(
      client,
      from,
      'Sorry, something went wrong generating your offer. Please try again.',
    );
  }
}

/**
 * Handle a button reply for a pending offer post (approve/edit/skip).
 */
export async function handleOfferApproval(
  client: Client,
  buttonId: string,
): Promise<void> {
  const parts = buttonId.substring(6).split('_'); // skip "offer_"
  const action = parts[0];
  const pendingId = parseInt(parts.slice(1).join('_'), 10);

  const pending = await db
    .select()
    .from(pendingPosts)
    .where(eq(pendingPosts.id, pendingId))
    .limit(1)
    .then((r) => r[0]);

  if (!pending) {
    log.warn({ pendingId }, 'No pending offer found');
    await sendConfirmationWithMenu(
      client,
      client.whatsappNumber,
      'This offer is no longer pending.',
    );
    return;
  }

  if (pending.status !== 'pending') {
    log.info({ pendingId, status: pending.status }, 'Offer already handled');
    return;
  }

  switch (action) {
    case 'approve': {
      const postName = await createOfferPost(
        client.id,
        client.gbpAccountId,
        client.gbpLocationId,
        pending.suggestedText,
        pending.offerEndDate || new Date(Date.now() + OFFER_DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000),
        pending.ctaType || 'CALL',
      );

      await db
        .update(pendingPosts)
        .set({ status: 'approved' })
        .where(eq(pendingPosts.id, pending.id));

      await db.insert(activityLog).values({
        clientId: client.id,
        type: 'offer_posted',
        payload: JSON.stringify({
          gbpPostName: postName,
          text: pending.suggestedText,
          action: 'approved',
        }),
        status: 'success',
      });

      await sendConfirmationWithMenu(
        client,
        client.whatsappNumber,
        'Your offer has been posted to Google Maps!',
      );
      log.info({ clientId: client.id, postName }, 'Offer post approved and published');
      break;
    }

    case 'edit': {
      await db
        .update(pendingPosts)
        .set({ status: 'awaiting_edit' })
        .where(eq(pendingPosts.id, pending.id));

      await whatsapp.sendTextMessage(
        client.whatsappNumber,
        "Type the offer text you'd like to publish:",
      );
      log.info({ clientId: client.id, pendingId }, 'Awaiting edited offer text');
      break;
    }

    case 'skip': {
      await db
        .update(pendingPosts)
        .set({ status: 'skipped' })
        .where(eq(pendingPosts.id, pending.id));

      await sendConfirmationWithMenu(client, client.whatsappNumber, 'Offer skipped.');
      log.info({ clientId: client.id, pendingId }, 'Offer post skipped');
      break;
    }

    default:
      log.warn({ action }, 'Unknown offer button action');
  }
}

/**
 * Handle edited offer text from a tradesperson who tapped "Edit".
 * Returns true if the message was consumed, false otherwise.
 */
export async function handleOfferEdit(
  client: Client,
  text: string,
): Promise<boolean> {
  const pending = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'awaiting_edit'),
        eq(pendingPosts.postType, 'offer'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!pending || pending.prompt === '__awaiting_offer_input__') return false;

  const postName = await createOfferPost(
    client.id,
    client.gbpAccountId,
    client.gbpLocationId,
    text,
    pending.offerEndDate || new Date(Date.now() + OFFER_DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000),
    pending.ctaType || 'CALL',
  );

  await db
    .update(pendingPosts)
    .set({ status: 'edited', customText: text })
    .where(eq(pendingPosts.id, pending.id));

  await db.insert(activityLog).values({
    clientId: client.id,
    type: 'offer_posted',
    payload: JSON.stringify({
      gbpPostName: postName,
      text,
      action: 'edited',
    }),
    status: 'success',
  });

  await sendConfirmationWithMenu(
    client,
    client.whatsappNumber,
    'Your offer has been posted to Google Maps!',
  );
  log.info({ clientId: client.id, postName }, 'Edited offer post published');
  return true;
}
