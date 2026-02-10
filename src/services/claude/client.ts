import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/env.js';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS_CAPTION, CLAUDE_MAX_TOKENS_REVIEW } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';
import {
  CAPTION_SYSTEM_PROMPT,
  REVIEW_RESPONSE_SYSTEM_PROMPT,
  buildCaptionUserPrompt,
  buildReviewResponseUserPrompt,
} from './prompts.js';
import type { CaptionRequest, ReviewResponseRequest } from './types.js';

const log = createChildLogger('claude');

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

/**
 * Polish a tradesperson's rough caption into a professional GBP post.
 */
export async function polishCaption(params: CaptionRequest): Promise<string> {
  log.info(
    { businessName: params.businessName, rawCaption: params.rawCaption },
    'Polishing caption',
  );

  const text = await retry(
    async () => {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS_CAPTION,
        system: CAPTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildCaptionUserPrompt(
              params.rawCaption,
              params.tradeType,
              params.businessName,
              params.county,
            ),
          },
        ],
      });

      const block = response.content[0];
      if (block.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }
      return block.text;
    },
    { maxAttempts: 2, baseDelay: 1000 },
  );

  log.info({ businessName: params.businessName }, 'Caption polished');
  return text;
}

/**
 * Generate a professional response to a Google review.
 */
export async function generateReviewResponse(
  params: ReviewResponseRequest,
): Promise<string> {
  log.info(
    { businessName: params.businessName, starRating: params.starRating },
    'Generating review response',
  );

  const text = await retry(
    async () => {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS_REVIEW,
        system: REVIEW_RESPONSE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildReviewResponseUserPrompt(
              params.reviewText,
              params.starRating,
              params.reviewerName,
              params.businessName,
              params.tradeType,
              params.county,
            ),
          },
        ],
      });

      const block = response.content[0];
      if (block.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }
      return block.text;
    },
    { maxAttempts: 2, baseDelay: 1000 },
  );

  log.info({ businessName: params.businessName }, 'Review response generated');
  return text;
}
