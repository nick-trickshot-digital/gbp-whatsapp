import sharp from 'sharp';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { polishCaption } from '../services/claude/client.js';
import { createPhotoPost } from '../services/gbp/posts.js';
import { commitProjectPhoto } from '../services/github/client.js';
import { db } from '../db/client.js';
import { activityLog } from '../db/schema.js';
import { IMAGE_MAX_WIDTH, IMAGE_QUALITY } from '../config/constants.js';
import { createChildLogger } from '../lib/logger.js';
import type { clients } from '../db/schema.js';
import type { InferSelectModel } from 'drizzle-orm';

const log = createChildLogger('photo-pipeline');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

interface PhotoMessage {
  from: string;
  imageId: string;
  caption: string | undefined;
  messageId: string;
}

/**
 * Execute the full photo pipeline:
 * 1. Download image from WhatsApp
 * 2. Optimize with sharp
 * 3. Polish caption with Claude
 * 4. Post to GBP + commit to GitHub (in parallel)
 * 5. Confirm to tradesperson
 */
export async function executePhotoPipeline(
  client: Client,
  message: PhotoMessage,
): Promise<void> {
  log.info(
    { clientId: client.id, messageId: message.messageId },
    'Starting photo pipeline',
  );

  try {
    // 1. Download image from WhatsApp
    const rawImage = await whatsapp.downloadMedia(message.imageId);
    log.info({ clientId: client.id, size: rawImage.length }, 'Image downloaded');

    // 2. Optimize image
    const optimizedImage = await sharp(rawImage)
      .resize(IMAGE_MAX_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: IMAGE_QUALITY })
      .toBuffer();
    log.info(
      { clientId: client.id, originalSize: rawImage.length, optimizedSize: optimizedImage.length },
      'Image optimized',
    );

    // 3. Polish caption with Claude
    const rawCaption = message.caption || `New project by ${client.businessName}`;
    const polishedCaption = await polishCaption({
      rawCaption,
      tradeType: client.tradeType,
      businessName: client.businessName,
      county: client.county,
    });
    log.info({ clientId: client.id }, 'Caption polished');

    // 4. Post to GBP and commit to GitHub in parallel
    const imageName = generateImageName(client, rawCaption);
    const markdownContent = generateAstroContent(
      client,
      polishedCaption,
      imageName,
    );

    const [gbpResult, githubResult] = await Promise.allSettled([
      createPhotoPost(
        client.id,
        client.gbpAccountId,
        client.gbpLocationId,
        optimizedImage,
        polishedCaption,
      ),
      commitProjectPhoto({
        repo: client.websiteRepo,
        imageBuffer: optimizedImage,
        imageName,
        markdownContent,
        commitMessage: `feat: add project photo - ${rawCaption.slice(0, 50)}`,
      }),
    ]);

    // 5. Log activity
    const gbpOk = gbpResult.status === 'fulfilled';
    const githubOk = githubResult.status === 'fulfilled';

    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'photo_posted',
      payload: JSON.stringify({
        gbpPostName: gbpOk ? gbpResult.value : null,
        githubCommitSha: githubOk ? githubResult.value.sha : null,
        caption: polishedCaption,
        gbpError: gbpOk ? null : String(gbpResult.reason),
        githubError: githubOk ? null : String(githubResult.reason),
      }),
      status: gbpOk && githubOk ? 'success' : 'failed',
      errorMessage: !gbpOk || !githubOk
        ? [
            !gbpOk ? `GBP: ${gbpResult.reason}` : null,
            !githubOk ? `GitHub: ${githubResult.reason}` : null,
          ]
            .filter(Boolean)
            .join('; ')
        : null,
    });

    // 6. Send confirmation to tradesperson
    if (gbpOk && githubOk) {
      await whatsapp.sendTextMessage(
        message.from,
        `Posted! Your photo is now on your Google Business Profile and website.`,
      );
    } else {
      const parts: string[] = ['Photo received.'];
      if (gbpOk) parts.push('Posted to Google.');
      else parts.push('Google posting failed - we\'ll retry shortly.');
      if (githubOk) parts.push('Website updated.');
      else parts.push('Website update pending.');
      await whatsapp.sendTextMessage(message.from, parts.join(' '));
    }

    if (!gbpOk) log.error({ err: gbpResult.reason }, 'GBP post failed');
    if (!githubOk) log.error({ err: githubResult.reason }, 'GitHub commit failed');

    log.info(
      { clientId: client.id, gbpOk, githubOk },
      'Photo pipeline completed',
    );
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Photo pipeline failed');

    await db.insert(activityLog).values({
      clientId: client.id,
      type: 'photo_posted',
      payload: JSON.stringify({ error: String(err) }),
      status: 'failed',
      errorMessage: String(err),
    });

    await whatsapp
      .sendTextMessage(
        message.from,
        'Sorry, something went wrong processing your photo. We\'ll look into it.',
      )
      .catch((sendErr) => log.error({ err: sendErr }, 'Failed to send error message'));
  }
}

function generateImageName(client: Client, caption: string): string {
  const date = new Date().toISOString().split('T')[0];
  const slug = caption
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug}-${date}.jpg`;
}

function generateAstroContent(
  client: Client,
  caption: string,
  imageName: string,
): string {
  const date = new Date().toISOString().split('T')[0];
  return `---
title: "${caption.split('.')[0].replace(/"/g, '\\"')}"
date: ${date}
image: ./${imageName}
trade: ${client.tradeType}
business: "${client.businessName}"
county: "${client.county}"
---

${caption}
`;
}
