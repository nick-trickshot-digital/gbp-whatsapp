import cron from 'node-cron';
import { runPollReviews } from './poll-reviews.js';
import { runSendDigests } from './send-digests.js';
import { runExpireReviews } from './expire-reviews.js';
import { DIGEST_TIMEZONE } from '../config/constants.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('scheduler');

let isReviewPollRunning = false;

/**
 * Register all cron jobs.
 * Call this once during application startup.
 */
export function registerJobs(): void {
  // Poll for new reviews every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    // Prevent overlapping runs
    if (isReviewPollRunning) {
      log.warn('Review poll still running, skipping this cycle');
      return;
    }
    isReviewPollRunning = true;
    try {
      await runPollReviews();
    } finally {
      isReviewPollRunning = false;
    }
  }, {
    timezone: DIGEST_TIMEZONE,
  });

  // Send weekly digests Monday at 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    await runSendDigests();
  }, {
    timezone: DIGEST_TIMEZONE,
  });

  // Expire pending reviews every hour
  cron.schedule('0 * * * *', async () => {
    await runExpireReviews();
  }, {
    timezone: DIGEST_TIMEZONE,
  });

  log.info('Cron jobs registered: review-poll (*/15min), digest (Mon 8AM), expire-reviews (hourly)');
}
