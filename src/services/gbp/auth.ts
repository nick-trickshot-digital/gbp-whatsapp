import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { config } from '../../config/env.js';
import { db } from '../../db/client.js';
import { clients } from '../../db/schema.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { createChildLogger } from '../../lib/logger.js';
import type { GbpTokens } from './types.js';

const log = createChildLogger('gbp-auth');

const TOKEN_REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

function createBaseOAuth2Client() {
  return new google.auth.OAuth2(
    config.GBP_CLIENT_ID,
    config.GBP_CLIENT_SECRET,
    config.GBP_REDIRECT_URI,
  );
}

/**
 * Generate the OAuth2 consent URL for client onboarding.
 */
export function getConsentUrl(state: string): string {
  const oauth2Client = createBaseOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/business.manage',
    ],
    state,
  });
}

/**
 * Exchange an authorization code for tokens and store them encrypted.
 */
export async function exchangeCodeForTokens(
  clientId: number,
  code: string,
): Promise<void> {
  const oauth2Client = createBaseOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing access_token or refresh_token from Google');
  }

  await storeTokens(clientId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor((tokens.expiry_date || Date.now() + 3600_000) / 1000),
  });

  log.info({ clientId }, 'GBP tokens stored successfully');
}

/**
 * Get an authenticated OAuth2 client for a specific client.
 * Automatically refreshes the token if expired.
 */
export async function getAuthenticatedClient(clientId: number) {
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
    .then((r) => r[0]);

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  if (!client.gbpRefreshToken || !client.gbpAccessToken) {
    throw new Error(`Client ${clientId} has no GBP tokens — needs OAuth onboarding`);
  }

  const accessToken = decrypt(client.gbpAccessToken);
  const refreshToken = decrypt(client.gbpRefreshToken);
  const expiresAt = client.gbpTokenExpiresAt || 0;

  const oauth2Client = createBaseOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiresAt * 1000,
  });

  // Refresh if expired or about to expire
  const now = Math.floor(Date.now() / 1000);
  if (now >= expiresAt - TOKEN_REFRESH_BUFFER_SECONDS) {
    log.info({ clientId }, 'Refreshing GBP access token');

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (credentials.access_token) {
      await storeTokens(clientId, {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: Math.floor(
          (credentials.expiry_date || Date.now() + 3600_000) / 1000,
        ),
      });
    }
  }

  return oauth2Client;
}

/**
 * After OAuth, discover the GBP account and location IDs and store them.
 * Searches all accounts for a location matching the client's business name.
 */
export async function discoverAccountAndLocation(clientId: number): Promise<void> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token for discovery');
  }

  // Get the client's business name for matching
  const client = await db
    .select({ businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
    .then((r) => r[0]);

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  // Step 1: List all accounts
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!accountsRes.ok) {
    const err = await accountsRes.json().catch(() => ({}));
    log.error({ clientId, err }, 'Failed to list GBP accounts');
    return;
  }

  const accountsData = (await accountsRes.json()) as {
    accounts?: Array<{ name: string; accountName: string; type: string }>;
  };

  if (!accountsData.accounts?.length) {
    log.warn({ clientId }, 'No GBP accounts found for this user');
    return;
  }

  log.info(
    { clientId, accounts: accountsData.accounts.map((a) => ({ name: a.name, accountName: a.accountName, type: a.type })) },
    'Found GBP accounts',
  );

  const businessNameLower = client.businessName.toLowerCase();

  // Step 2: Search all accounts for locations, matching by business name
  for (const account of accountsData.accounts) {
    const accountId = account.name.replace('accounts/', '');

    const locationsRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!locationsRes.ok) {
      log.warn({ clientId, accountId }, 'Failed to list locations for account, skipping');
      continue;
    }

    const locationsData = (await locationsRes.json()) as {
      locations?: Array<{ name: string; title: string }>;
    };

    if (!locationsData.locations?.length) {
      log.info({ clientId, accountId, accountName: account.accountName }, 'No locations in this account');
      continue;
    }

    log.info(
      { clientId, accountId, locations: locationsData.locations.map((l) => ({ name: l.name, title: l.title })) },
      'Found locations in account',
    );

    // Try to match by business name
    const match = locationsData.locations.find(
      (l) => l.title.toLowerCase().includes(businessNameLower) || businessNameLower.includes(l.title.toLowerCase()),
    );

    const location = match || locationsData.locations[0];
    const locationId = location.name.replace('locations/', '');

    if (match) {
      log.info({ clientId, accountId, locationId, title: location.title }, 'Matched GBP location by business name');
    } else {
      log.info({ clientId, accountId, locationId, title: location.title }, 'Using first location (no name match)');
    }

    await db
      .update(clients)
      .set({ gbpAccountId: accountId, gbpLocationId: locationId })
      .where(eq(clients.id, clientId));
    return;
  }

  // No locations found in any account — save the first account ID at least
  const firstAccountId = accountsData.accounts[0].name.replace('accounts/', '');
  log.warn({ clientId, firstAccountId }, 'No locations found in any account');
  await db
    .update(clients)
    .set({ gbpAccountId: firstAccountId })
    .where(eq(clients.id, clientId));
}

async function storeTokens(clientId: number, tokens: GbpTokens): Promise<void> {
  await db
    .update(clients)
    .set({
      gbpAccessToken: encrypt(tokens.accessToken),
      gbpRefreshToken: encrypt(tokens.refreshToken),
      gbpTokenExpiresAt: tokens.expiresAt,
    })
    .where(eq(clients.id, clientId));
}
