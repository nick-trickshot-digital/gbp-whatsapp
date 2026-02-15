import { eq, and, ne } from 'drizzle-orm';
import sharp from 'sharp';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { generateGbpPost } from '../services/claude/client.js';
import { createPhotoPost, createTextPost } from '../services/gbp/posts.js';
import { saveImage, generateImageName } from '../lib/image-storage.js';
import { db } from '../db/client.js';
import { pendingPosts, activityLog } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';
import { sendConfirmationWithMenu } from './menu.js';
import { IMAGE_MAX_WIDTH, IMAGE_QUALITY } from '../config/constants.js';
import type { clients } from '../db/schema.js';
import type { InferSelectModel } from 'drizzle-orm';

const log = createChildLogger('gbp-post');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

/**
 * Generate a GBP post suggestion and send it for approval.
 * Triggered when a tradesperson selects "Create a Post" from the menu.
 */
export async function startGbpPost(
  client: Client,
  prompt: string,
  from: string,
): Promise<void> {
  log.info({ clientId: client.id, prompt }, 'Generating GBP post suggestion');

  try {
    const suggestedText = await generateGbpPost({
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

    const [pending] = await db.insert(pendingPosts).values({
      clientId: client.id,
      prompt,
      suggestedText,
      status: 'pending',
    }).returning();

    // WhatsApp interactive body max is 1024 chars — truncate preview if needed
    const maxPreviewLen = 950;
    const previewText = suggestedText.length > maxPreviewLen
      ? suggestedText.slice(0, maxPreviewLen) + '...'
      : suggestedText;

    await whatsapp.sendInteractiveButtons(
      from,
      `Here's a draft for your Google profile:\n\n"${previewText}"`,
      [
        { id: `post_approve_${pending.id}`, title: 'Post It' },
        { id: `post_edit_${pending.id}`, title: 'Edit' },
        { id: `post_skip_${pending.id}`, title: 'Skip' },
      ],
    );

    log.info({ clientId: client.id, pendingId: pending.id }, 'GBP post suggestion sent');
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Failed to generate GBP post suggestion');

    await sendConfirmationWithMenu(
      client,
      from,
      'Sorry, something went wrong generating your post. Please try again.',
    );
  }
}

/**
 * Handle a button reply for a pending GBP post (approve/edit/skip).
 */
export async function handlePostApproval(
  client: Client,
  buttonId: string,
): Promise<void> {
  const parts = buttonId.substring(5).split('_'); // skip "post_"
  const action = parts[0];
  const pendingId = parseInt(parts.slice(1).join('_'), 10);

  const pending = await db
    .select()
    .from(pendingPosts)
    .where(eq(pendingPosts.id, pendingId))
    .limit(1)
    .then((r) => r[0]);

  if (!pending) {
    log.warn({ pendingId }, 'No pending post found');
    await sendConfirmationWithMenu(
      client,
      client.whatsappNumber,
      'This post is no longer pending.',
    );
    return;
  }

  switch (action) {
    case 'approve': {
      // Only process if status is 'pending'
      if (pending.status !== 'pending') {
        log.info({ pendingId, status: pending.status }, 'Post already handled');
        return;
      }
      // Ask if they want to add a photo
      await db
        .update(pendingPosts)
        .set({ status: 'awaiting_photo', awaitingPhoto: true })
        .where(eq(pendingPosts.id, pending.id));

      await whatsapp.sendInteractiveButtons(
        client.whatsappNumber,
        'Want to add a photo to this post? Send it now or skip.',
        [
          { id: `post_photo_skip_${pending.id}`, title: 'Skip (Post Now)' },
        ],
      );
      log.info({ clientId: client.id, pendingId: pending.id }, 'Awaiting photo for post');
      break;
    }

    case 'photo': {
      const photoAction = parts[1]; // 'skip'
      const photoPostId = parseInt(parts.slice(2).join('_'), 10);

      // Only process if status is 'awaiting_photo'
      if (pending.status !== 'awaiting_photo') {
        log.info({ pendingId, status: pending.status }, 'Post not awaiting photo');
        return;
      }

      if (photoAction === 'skip') {
        // Post without photo
        const postName = await createTextPost(
          client.id,
          client.gbpAccountId,
          client.gbpLocationId,
          pending.suggestedText,
        );

        await db
          .update(pendingPosts)
          .set({ status: 'approved', awaitingPhoto: false })
          .where(eq(pendingPosts.id, photoPostId));

        await db.insert(activityLog).values({
          clientId: client.id,
          type: 'gbp_post',
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
          'Posted to your Google profile!',
        );
        log.info({ clientId: client.id, postName }, 'GBP post published without photo');
      }
      break;
    }

    case 'edit': {
      // Only process if status is 'pending'
      if (pending.status !== 'pending') {
        log.info({ pendingId, status: pending.status }, 'Post already handled');
        return;
      }

      await db
        .update(pendingPosts)
        .set({ status: 'awaiting_edit' })
        .where(eq(pendingPosts.id, pending.id));

      // WhatsApp interactive body max is 1024 chars — truncate if needed
      const maxLen = 900;
      const currentDraft = pending.suggestedText.length > maxLen
        ? pending.suggestedText.slice(0, maxLen) + '...'
        : pending.suggestedText;

      await whatsapp.sendTextMessage(
        client.whatsappNumber,
        `Current draft:\n\n"${currentDraft}"\n\nWhat would you like to change? (e.g., "make it shorter", "add that it's for income protection too", "more professional tone")`,
      );
      log.info({ clientId: client.id, pendingId }, 'Awaiting edit feedback');
      break;
    }

    case 'skip': {
      // Only process if status is 'pending'
      if (pending.status !== 'pending') {
        log.info({ pendingId, status: pending.status }, 'Post already handled');
        return;
      }
      await db
        .update(pendingPosts)
        .set({ status: 'skipped' })
        .where(eq(pendingPosts.id, pending.id));

      await sendConfirmationWithMenu(client, client.whatsappNumber, 'Skipped.');
      log.info({ clientId: client.id, pendingId }, 'GBP post skipped');
      break;
    }

    default:
      log.warn({ action }, 'Unknown post button action');
  }
}

/**
 * Handle edit feedback from a tradesperson who tapped "Edit".
 * Regenerates the post incorporating their feedback.
 * Returns true if the message was consumed, false otherwise.
 */
export async function handlePostEdit(
  client: Client,
  feedback: string,
): Promise<boolean> {
  const pending = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'awaiting_edit'),
        eq(pendingPosts.postType, 'standard'),
        ne(pendingPosts.prompt, '__awaiting_input__'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!pending) return false;

  log.info({ clientId: client.id, pendingId: pending.id }, 'Regenerating post with feedback');

  try {
    // Regenerate with feedback incorporated
    const revisedPrompt = `${pending.prompt}\n\nRevision request: ${feedback}\n\nCurrent draft to revise:\n"${pending.suggestedText}"`;

    const revisedText = await generateGbpPost({
      prompt: revisedPrompt,
      tradeType: client.tradeType,
      businessName: client.businessName,
      county: client.county,
      businessContext: {
        summary: client.websiteSummary ?? undefined,
        serviceAreas: client.serviceAreas ?? undefined,
        services: client.services ?? undefined,
      },
    });

    // Update the pending post with the revised text and reset to pending for approval
    await db
      .update(pendingPosts)
      .set({
        suggestedText: revisedText,
        status: 'pending',
      })
      .where(eq(pendingPosts.id, pending.id));

    // Show the revised version for approval
    const maxPreviewLen = 950;
    const previewText = revisedText.length > maxPreviewLen
      ? revisedText.slice(0, maxPreviewLen) + '...'
      : revisedText;

    await whatsapp.sendInteractiveButtons(
      client.whatsappNumber,
      `Here's the revised version:\n\n"${previewText}"`,
      [
        { id: `post_approve_${pending.id}`, title: 'Post It' },
        { id: `post_edit_${pending.id}`, title: 'Edit Again' },
        { id: `post_skip_${pending.id}`, title: 'Skip' },
      ],
    );

    log.info({ clientId: client.id, pendingId: pending.id }, 'Revised post sent for approval');
    return true;
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Failed to regenerate post');
    await sendConfirmationWithMenu(
      client,
      client.whatsappNumber,
      'Sorry, something went wrong revising your post. Please try again.',
    );
    return true;
  }
}

/**
 * Handle a photo attachment for a pending post.
 * Returns true if the message was consumed, false otherwise.
 */
export async function handlePostPhoto(
  client: Client,
  imageId: string,
): Promise<boolean> {
  const pending = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'awaiting_photo'),
        eq(pendingPosts.awaitingPhoto, true),
        eq(pendingPosts.postType, 'standard'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!pending) return false;

  log.info({ clientId: client.id, pendingId: pending.id }, 'Processing photo for post');

  try {
    const caption = pending.customText || pending.suggestedText;

    // Download and optimize image
    const rawImage = await whatsapp.downloadMedia(imageId);
    const optimizedImage = await sharp(rawImage)
      .resize(IMAGE_MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: IMAGE_QUALITY })
      .toBuffer();

    // Save image to VPS and get public URL
    const imageName = generateImageName(caption);
    const imageUrl = await saveImage(optimizedImage, imageName);

    // Post to GBP with the VPS-hosted image URL
    const postName = await createPhotoPost(
      client.id,
      client.gbpAccountId,
      client.gbpLocationId,
      imageUrl,
      caption,
    );

    await db
      .update(pendingPosts)
      .set({ status: 'approved', awaitingPhoto: false })
      .where(eq(pendingPosts.id, pending.id));

    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'gbp_post',
      payload: JSON.stringify({
        gbpPostName: postName,
        text: caption,
        action: 'approved_with_photo',
      }),
      status: 'success',
    });

    await sendConfirmationWithMenu(
      client,
      client.whatsappNumber,
      'Posted to your Google profile with your photo!',
    );
    log.info({ clientId: client.id, postName }, 'GBP post with photo published');
    return true;
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Failed to attach photo to post');
    await sendConfirmationWithMenu(
      client,
      client.whatsappNumber,
      'Sorry, something went wrong with your photo. The post was not published.',
    );
    return true;
  }
}
