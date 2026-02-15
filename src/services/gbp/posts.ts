import { getAuthenticatedClient } from './auth.js';
import { GBP_API_V4_BASE } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('gbp-posts');

/**
 * Create a photo post (Local Post) on a client's Google Business Profile.
 *
 * The GBP v4 Local Posts API requires an HTTPS sourceUrl.
 * The image should already be uploaded to GitHub or another public host.
 */
export async function createPhotoPost(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  log.info({ clientId, gbpLocationId, imageUrl }, 'Creating GBP photo post');

  const postName = await retry(
    async () => {
      const response = await fetch(
        `${GBP_API_V4_BASE}/accounts/${gbpAccountId}/locations/${gbpLocationId}/localPosts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            languageCode: 'en',
            summary: caption,
            media: [
              {
                mediaFormat: 'PHOTO',
                sourceUrl: imageUrl,
              },
            ],
            topicType: 'STANDARD',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }

      const result = (await response.json()) as { name: string };
      return result.name;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );

  log.info({ clientId, postName }, 'GBP photo post created');
  return postName;
}


/**
 * Create a text-only post (Local Post) on a client's Google Business Profile.
 */
export async function createTextPost(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  caption: string,
): Promise<string> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  log.info({ clientId, gbpLocationId }, 'Creating GBP text post');

  const postName = await retry(
    async () => {
      const response = await fetch(
        `${GBP_API_V4_BASE}/accounts/${gbpAccountId}/locations/${gbpLocationId}/localPosts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            languageCode: 'en',
            summary: caption,
            topicType: 'STANDARD',
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }

      const result = (await response.json()) as { name: string };
      return result.name;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );

  log.info({ clientId, postName }, 'GBP text post created');
  return postName;
}

/**
 * Create an offer post on a client's Google Business Profile.
 * Includes call-to-action button and offer validity dates.
 */
export async function createOfferPost(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  caption: string,
  offerEndDate: Date,
  ctaType: string = 'CALL',
): Promise<string> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  log.info({ clientId, gbpLocationId }, 'Creating GBP offer post');

  const now = new Date();
  const formatDate = (d: Date) => ({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });

  const postName = await retry(
    async () => {
      const response = await fetch(
        `${GBP_API_V4_BASE}/accounts/${gbpAccountId}/locations/${gbpLocationId}/localPosts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            languageCode: 'en',
            summary: caption,
            topicType: 'OFFER',
            callToAction: {
              actionType: ctaType,
            },
            event: {
              title: 'Special Offer',
              schedule: {
                startDate: formatDate(now),
                endDate: formatDate(offerEndDate),
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }

      const result = (await response.json()) as { name: string };
      return result.name;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );

  log.info({ clientId, postName }, 'GBP offer post created');
  return postName;
}

export class GbpApiError extends Error {
  constructor(
    public statusCode: number,
    public apiError: unknown,
  ) {
    super(`GBP API error ${statusCode}`);
    this.name = 'GbpApiError';
  }

  get isAuthError() {
    return this.statusCode === 401;
  }

  get isRateLimit() {
    return this.statusCode === 429;
  }
}
