import { getAuthenticatedClient } from './auth.js';
import { GBP_API_V4_BASE } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';
import { GbpApiError } from './posts.js';
import type { GbpReview, GbpReviewsResponse } from './types.js';

const log = createChildLogger('gbp-reviews');

/**
 * List reviews for a GBP location.
 */
export async function listReviews(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  pageToken?: string,
): Promise<GbpReviewsResponse> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  const url = new URL(
    `${GBP_API_V4_BASE}/accounts/${gbpAccountId}/locations/${gbpLocationId}/reviews`,
  );
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('orderBy', 'updateTime desc');
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  return retry(
    async () => {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }

      return (await response.json()) as GbpReviewsResponse;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );
}

/**
 * Get new reviews since a given timestamp.
 * Returns reviews that were created after the specified time
 * and have no reply yet.
 */
export async function getNewUnrepliedReviews(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  sinceTimestamp: Date,
): Promise<GbpReview[]> {
  const reviews: GbpReview[] = [];
  let pageToken: string | undefined;

  do {
    const response = await listReviews(
      clientId,
      gbpAccountId,
      gbpLocationId,
      pageToken,
    );

    if (!response.reviews) break;

    for (const review of response.reviews) {
      const reviewTime = new Date(review.updateTime);

      // Stop paginating once we hit reviews older than our cutoff
      if (reviewTime < sinceTimestamp) {
        return reviews;
      }

      // Only include reviews without a reply
      if (!review.reviewReply) {
        reviews.push(review);
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return reviews;
}

/**
 * Post a reply to a review on GBP.
 */
export async function replyToReview(
  clientId: number,
  reviewName: string,
  replyText: string,
): Promise<void> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  log.info({ clientId, reviewName }, 'Posting review reply to GBP');

  await retry(
    async () => {
      const response = await fetch(
        `${GBP_API_V4_BASE}/${reviewName}/reply`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment: replyText }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );

  log.info({ clientId, reviewName }, 'Review reply posted');
}
