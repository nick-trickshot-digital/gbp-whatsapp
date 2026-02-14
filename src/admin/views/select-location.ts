import { layout } from './layout.js';
import { escapeHtml } from './helpers.js';
import type { DiscoveredLocation } from '../../services/gbp/auth.js';

export function selectLocationPage(
  clientId: number,
  businessName: string,
  locations: DiscoveredLocation[],
): string {
  const hasLocations = locations.length > 0;

  const locationsList = locations
    .map(
      (loc) => `
      <label>
        <input type="radio" name="location" value="${escapeHtml(loc.accountId)}|${escapeHtml(loc.locationId)}" required>
        <strong>${escapeHtml(loc.locationName)}</strong>
        <span class="text-muted"> &mdash; ${escapeHtml(loc.accountName)}</span>
      </label>`,
    )
    .join('\n');

  const content = `
    <hgroup>
      <h2>Select Business Location</h2>
      <p>Choose the Google Business Profile location for <strong>${escapeHtml(businessName)}</strong></p>
    </hgroup>

    <form method="POST" action="/admin/clients/${clientId}/select-location">
      ${
        hasLocations
          ? `
        <fieldset>
          <legend>Found ${locations.length} location${locations.length > 1 ? 's' : ''}</legend>
          ${locationsList}
        </fieldset>
      `
          : `
        <article style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 4px;">
          <p><strong>No locations found automatically.</strong></p>
          <p>This can happen if the Google APIs haven't fully propagated yet, or if the business is in a location group. Enter the IDs manually below.</p>
        </article>
      `
      }

      <details ${hasLocations ? '' : 'open'}>
        <summary>Enter manually</summary>
        <p class="text-muted">Find these in Google Business Profile Manager &rarr; your business &rarr; the URL contains the account and location IDs.</p>
        <label for="manualAccountId">GBP Account ID</label>
        <input type="text" id="manualAccountId" name="manualAccountId" placeholder="e.g. 115104611603806617634">
        <label for="manualLocationId">GBP Location ID</label>
        <input type="text" id="manualLocationId" name="manualLocationId" placeholder="e.g. 12345678901234567">
      </details>

      <div class="actions" style="margin-top: 1rem; gap: 1rem;">
        <button type="submit">Save Location</button>
        <a href="/admin/clients" role="button" class="outline">Skip for now</a>
      </div>
    </form>
  `;

  return layout('Select Location', content);
}
