import { sendDigests } from '../workflows/weekly-digest.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('job:send-digests');

export async function runSendDigests(): Promise<void> {
  log.info('Starting weekly digest job');

  try {
    await sendDigests();
    log.info('Weekly digest job completed');
  } catch (err) {
    log.error({ err }, 'Weekly digest job failed');
  }
}
