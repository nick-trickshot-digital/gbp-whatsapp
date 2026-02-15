import { getAuthenticatedClient } from './auth.js';
import { GBP_API_V4_BASE } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('gbp-posts');

/**
 * Create a photo post (Local Post) on a client's Google Business Profile.
 *
 * The GBP v4 Local Posts API requires:
 * 1. Upload the photo as media first
 * 2. Create the local post referencing the media
 */
export async function createPhotoPost(
  clientId: number,
  gbpAccountId: string,
  gbpLocationId: string,
  imageBuffer: Buffer,
  caption: string,
): Promise<string> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  // Step 1: Upload photo as media
  log.info({ clientId, gbpLocationId }, 'Uploading photo to GBP');

  const mediaUrl = await uploadMedia(
    accessToken,
    gbpAccountId,
    gbpLocationId,
    imageBuffer,
  );

  // Step 2: Create local post with the uploaded media
  log.info({ clientId, gbpLocationId }, 'Creating GBP local post');

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
                sourceUrl: mediaUrl,
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

  log.info({ clientId, postName }, 'GBP local post created');
  return postName;
}

async function uploadMedia(
  accessToken: string,
  gbpAccountId: string,
  gbpLocationId: string,
  imageBuffer: Buffer,
): Promise<string> {
  return retry(
    async () => {
      const response = await fetch(
        `${GBP_API_V4_BASE}/accounts/${gbpAccountId}/locations/${gbpLocationId}/media`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaFormat: 'PHOTO',
            locationAssociation: { category: 'ADDITIONAL' },
            dataRef: {
              resourceName: `accounts/${gbpAccountId}/locations/${gbpLocationId}/media`,
            },
            // Upload as base64 data
            sourceUrl: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new GbpApiError(response.status, error);
      }

      const result = (await response.json()) as { googleUrl: string; name: string };
      return result.googleUrl;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );
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
