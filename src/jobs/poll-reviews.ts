import { processNewReviews } from '../workflows/review-response.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('job:poll-reviews');

export async function runPollReviews(): Promise<void> {
  log.info('Starting review poll job');

  try {
    await processNewReviews();
    log.info('Review poll job completed');
  } catch (err) {
    log.error({ err }, 'Review poll job failed');
  }
}
