import { eq, and, ne } from 'drizzle-orm';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { generateGbpPost } from '../services/claude/client.js';
import { createTextPost } from '../services/gbp/posts.js';
import { db } from '../db/client.js';
import { pendingPosts, activityLog } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';
import { sendConfirmationWithMenu } from './menu.js';
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

  if (pending.status !== 'pending') {
    log.info({ pendingId, status: pending.status }, 'Post already handled');
    return;
  }

  switch (action) {
    case 'approve': {
      const postName = await createTextPost(
        client.id,
        client.gbpAccountId,
        client.gbpLocationId,
        pending.suggestedText,
      );

      await db
        .update(pendingPosts)
        .set({ status: 'approved' })
        .where(eq(pendingPosts.id, pending.id));

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
      log.info({ clientId: client.id, postName }, 'GBP post approved and published');
      break;
    }

    case 'edit': {
      await db
        .update(pendingPosts)
        .set({ status: 'awaiting_edit' })
        .where(eq(pendingPosts.id, pending.id));

      await whatsapp.sendTextMessage(
        client.whatsappNumber,
        'Type the post you\'d like to publish:',
      );
      log.info({ clientId: client.id, pendingId }, 'Awaiting edited post text');
      break;
    }

    case 'skip': {
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
 * Handle edited post text from a tradesperson who tapped "Edit".
 * Returns true if the message was consumed, false otherwise.
 */
export async function handlePostEdit(
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
        eq(pendingPosts.postType, 'standard'),
        ne(pendingPosts.prompt, '__awaiting_input__'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!pending) return false;

  const postName = await createTextPost(
    client.id,
    client.gbpAccountId,
    client.gbpLocationId,
    text,
  );

  await db
    .update(pendingPosts)
    .set({ status: 'edited', customText: text })
    .where(eq(pendingPosts.id, pending.id));

  await db.insert(activityLog).values({
    clientId: client.id,
    type: 'gbp_post',
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
    'Your post has been published!',
  );
  log.info({ clientId: client.id, postName }, 'Edited GBP post published');
  return true;
}
