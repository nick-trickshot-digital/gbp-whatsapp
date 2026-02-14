import { WhatsAppService } from '../services/whatsapp/client.js';
import { polishCaption } from '../services/claude/client.js';
import { createTextPost } from '../services/gbp/posts.js';
import { db } from '../db/client.js';
import { activityLog } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';
import type { clients } from '../db/schema.js';
import type { InferSelectModel } from 'drizzle-orm';

const log = createChildLogger('gbp-post');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

/**
 * Post a text-only update to a client's Google Business Profile.
 * Triggered when a tradesperson sends a WhatsApp message starting with "post ".
 */
export async function executeGbpPost(
  client: Client,
  rawText: string,
  from: string,
): Promise<void> {
  log.info({ clientId: client.id }, 'Starting GBP text post');

  try {
    // 1. Polish the text with Claude
    const polishedText = await polishCaption({
      rawCaption: rawText,
      tradeType: client.tradeType,
      businessName: client.businessName,
      county: client.county,
    });
    log.info({ clientId: client.id }, 'Post text polished');

    // 2. Create text-only GBP post
    const postName = await createTextPost(
      client.id,
      client.gbpAccountId,
      client.gbpLocationId,
      polishedText,
    );

    // 3. Log activity
    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'gbp_post',
      payload: JSON.stringify({
        gbpPostName: postName,
        rawText,
        polishedText,
      }),
      status: 'success',
    });

    // 4. Confirm to tradesperson
    await whatsapp.sendTextMessage(
      from,
      `Posted to your Google Business Profile!\n\n"${polishedText}"`,
    );

    log.info({ clientId: client.id, postName }, 'GBP text post completed');
  } catch (err) {
    log.error({ err, clientId: client.id }, 'GBP text post failed');

    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'gbp_post',
      payload: JSON.stringify({ error: String(err), rawText }),
      status: 'failed',
      errorMessage: String(err),
    });

    await whatsapp
      .sendTextMessage(
        from,
        'Sorry, something went wrong posting to your Google profile. We\'ll look into it.',
      )
      .catch((sendErr) => log.error({ err: sendErr }, 'Failed to send error message'));
  }
}
