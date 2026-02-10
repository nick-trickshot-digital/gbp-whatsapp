import { layout } from './layout.js';
import { escapeHtml, formatDate } from './helpers.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { pendingReviews, clients } from '../../db/schema.js';

type Review = InferSelectModel<typeof pendingReviews>;
type Client = InferSelectModel<typeof clients>;

function stars(rating: number): string {
  return '<span class="star">' + '\u2605'.repeat(rating) + '</span>' + '\u2606'.repeat(5 - rating);
}

export function reviewRow(r: Review & { client?: Client | null }): string {
  const isPending = r.status === 'pending' || r.status === 'awaiting_custom_reply';
  const statusColors: Record<string, string> = {
    pending: 'badge-warning',
    awaiting_custom_reply: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-muted',
    custom_reply: 'badge-success',
    expired: 'badge-danger',
  };
  const cls = statusColors[r.status] ?? 'badge-muted';

  const actions = isPending
    ? `<div class="actions">
        <button hx-post="/admin/reviews/${r.id}/approve" hx-target="#review-${r.id}" hx-swap="outerHTML"
                class="outline" style="padding:0.3rem 0.6rem;font-size:0.85rem;">Approve</button>
        <button hx-post="/admin/reviews/${r.id}/reject" hx-target="#review-${r.id}" hx-swap="outerHTML"
                class="outline secondary" style="padding:0.3rem 0.6rem;font-size:0.85rem;">Reject</button>
        <button hx-post="/admin/reviews/${r.id}/expire" hx-target="#review-${r.id}" hx-swap="outerHTML"
                class="outline contrast" style="padding:0.3rem 0.6rem;font-size:0.85rem;">Expire</button>
      </div>`
    : '';

  return `
  <tr id="review-${r.id}">
    <td>${escapeHtml(r.client?.businessName ?? `#${r.clientId}`)}</td>
    <td>${escapeHtml(r.reviewerName)}</td>
    <td>${stars(r.starRating)}</td>
    <td><pre class="review-text">${escapeHtml(r.reviewText)}</pre></td>
    <td><pre class="review-text">${escapeHtml(r.suggestedReply)}</pre></td>
    <td><span class="badge ${cls}">${escapeHtml(r.status)}</span></td>
    <td>${formatDate(r.createdAt)}</td>
    <td>${actions}</td>
  </tr>`;
}

export function reviewsListPage(
  reviews: (Review & { client?: Client | null })[],
): string {
  const rows = reviews.map((r) => reviewRow(r)).join('');

  return layout(
    'Reviews',
    `
    <h2>Pending Reviews</h2>
    <figure>
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Reviewer</th><th>Rating</th><th>Review</th>
            <th>Suggested Reply</th><th>Status</th><th>Date</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="8" class="text-muted">No pending reviews</td></tr>'}
        </tbody>
      </table>
    </figure>`,
  );
}
