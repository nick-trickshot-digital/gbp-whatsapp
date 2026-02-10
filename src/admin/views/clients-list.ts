import { layout } from './layout.js';
import { escapeHtml, statusBadge, tokenStatusBadge } from './helpers.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { clients } from '../../db/schema.js';

type Client = InferSelectModel<typeof clients>;

export function clientsListPage(allClients: Client[], flash?: { type: string; message: string }): string {
  const rows = allClients
    .map(
      (c) => `
    <tr id="client-${c.id}">
      <td>${escapeHtml(c.businessName)}</td>
      <td>${escapeHtml(c.tradeType)}</td>
      <td>${escapeHtml(c.county)}</td>
      <td>${escapeHtml(c.whatsappNumber)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${tokenStatusBadge(c.gbpAccessToken, c.gbpTokenExpiresAt)}</td>
      <td class="actions">
        <a href="/admin/clients/${c.id}/edit" role="button" class="outline secondary">Edit</a>
        <a href="/admin/clients/${c.id}/oauth" role="button" class="outline">Connect GBP</a>
        <form method="POST" action="/admin/clients/${c.id}/delete" style="margin:0"
              onsubmit="return confirm('Delete ${escapeHtml(c.businessName)}?')">
          <button type="submit" class="outline contrast" style="padding:0.3rem 0.6rem;font-size:0.85rem;">Delete</button>
        </form>
      </td>
    </tr>`,
    )
    .join('');

  return layout(
    'Clients',
    `
    <hgroup>
      <h2>Clients</h2>
      <p>${allClients.length} registered client${allClients.length !== 1 ? 's' : ''}</p>
    </hgroup>
    <a href="/admin/clients/new" role="button" style="margin-bottom:1rem;display:inline-block;">+ Add Client</a>
    <figure>
      <table>
        <thead>
          <tr>
            <th>Business</th><th>Trade</th><th>County</th>
            <th>WhatsApp</th><th>Status</th><th>GBP</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" class="text-muted">No clients yet</td></tr>'}</tbody>
      </table>
    </figure>`,
    flash,
  );
}
