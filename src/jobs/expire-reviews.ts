import { expirePendingReviews } from '../workflows/review-response.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('job:expire-reviews');

export async function runExpireReviews(): Promise<void> {
  log.info('Starting review expiry job');

  try {
    await expirePendingReviews();
    log.info('Review expiry job completed');
  } catch (err) {
    log.error({ err }, 'Review expiry job failed');
  }
}
