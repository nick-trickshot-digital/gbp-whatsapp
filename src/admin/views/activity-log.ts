import { layout } from './layout.js';
import { escapeHtml, formatDate, statusBadge } from './helpers.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { activityLog, clients } from '../../db/schema.js';

type Activity = InferSelectModel<typeof activityLog>;
type Client = InferSelectModel<typeof clients>;

export function activityLogPage(
  activities: (Activity & { client?: Client | null })[],
  allClients: Client[],
  filters: { clientId?: string; page: number },
  hasMore: boolean,
): string {
  const clientOptions = allClients
    .map(
      (c) =>
        `<option value="${c.id}" ${filters.clientId === String(c.id) ? 'selected' : ''}>${escapeHtml(c.businessName)}</option>`,
    )
    .join('');

  const rows = activities.map((a) => activityRow(a)).join('');

  const nextPage = filters.page + 1;
  const loadMoreRow = hasMore
    ? `<tr hx-get="/admin/activity/page?page=${nextPage}${filters.clientId ? `&clientId=${filters.clientId}` : ''}"
           hx-trigger="revealed" hx-swap="afterend" hx-target="this">
        <td colspan="6"><span aria-busy="true">Loading more...</span></td>
      </tr>`
    : '';

  return layout(
    'Activity Log',
    `
    <h2>Activity Log</h2>
    <form method="GET" action="/admin/activity" style="display:flex;gap:1rem;align-items:end;margin-bottom:1rem;">
      <label style="margin:0;">
        Filter by client
        <select name="clientId" style="margin:0;">
          <option value="">All clients</option>
          ${clientOptions}
        </select>
      </label>
      <button type="submit" style="margin:0;">Filter</button>
    </form>
    <figure>
      <table>
        <thead>
          <tr>
            <th>Time</th><th>Client</th><th>Type</th><th>Status</th><th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="text-muted">No activity recorded</td></tr>'}
          ${loadMoreRow}
        </tbody>
      </table>
    </figure>`,
  );
}

export function activityRow(a: Activity & { client?: Client | null }): string {
  const typeLabels: Record<string, string> = {
    photo_posted: 'Photo Posted',
    review_alert: 'Review Alert',
    review_responded: 'Review Responded',
    digest_sent: 'Digest Sent',
  };

  return `
  <tr>
    <td>${formatDate(a.createdAt)}</td>
    <td>${escapeHtml(a.client?.businessName ?? `#${a.clientId}`)}</td>
    <td>${escapeHtml(typeLabels[a.type] ?? a.type)}</td>
    <td>${statusBadge(a.status)}</td>
    <td>${a.errorMessage ? `<small class="text-muted">${escapeHtml(a.errorMessage)}</small>` : '-'}</td>
  </tr>`;
}

export function activityRowsPartial(
  activities: (Activity & { client?: Client | null })[],
  filters: { clientId?: string; page: number },
  hasMore: boolean,
): string {
  const rows = activities.map((a) => activityRow(a)).join('');
  const nextPage = filters.page + 1;
  const loadMore = hasMore
    ? `<tr hx-get="/admin/activity/page?page=${nextPage}${filters.clientId ? `&clientId=${filters.clientId}` : ''}"
           hx-trigger="revealed" hx-swap="afterend" hx-target="this">
        <td colspan="5"><span aria-busy="true">Loading more...</span></td>
      </tr>`
    : '';
  return rows + loadMore;
}
