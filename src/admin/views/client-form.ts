import { layout } from './layout.js';
import { escapeHtml } from './helpers.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { clients } from '../../db/schema.js';

type Client = InferSelectModel<typeof clients>;

interface FormData {
  businessName?: string;
  tradeType?: string;
  county?: string;
  whatsappNumber?: string;
  gbpAccountId?: string;
  gbpLocationId?: string;
  websiteRepo?: string;
  status?: string;
}

export function clientFormPage(
  client?: Client | null,
  error?: string,
  formData?: FormData,
): string {
  const isEdit = !!client;
  const title = isEdit ? `Edit ${client!.businessName}` : 'Add Client';
  const action = isEdit ? `/admin/clients/${client!.id}` : '/admin/clients';

  const v = {
    businessName: formData?.businessName ?? client?.businessName ?? '',
    tradeType: formData?.tradeType ?? client?.tradeType ?? '',
    county: formData?.county ?? client?.county ?? '',
    whatsappNumber: formData?.whatsappNumber ?? client?.whatsappNumber ?? '',
    gbpAccountId: formData?.gbpAccountId ?? client?.gbpAccountId ?? '',
    gbpLocationId: formData?.gbpLocationId ?? client?.gbpLocationId ?? '',
    websiteRepo: formData?.websiteRepo ?? client?.websiteRepo ?? '',
    status: formData?.status ?? client?.status ?? 'active',
  };

  const errorHtml = error
    ? `<div role="alert" style="background:#f8d7da;color:#721c24;padding:1rem;border-radius:4px;margin-bottom:1rem;border:1px solid #f5c6cb;">${escapeHtml(error)}</div>`
    : '';

  const statusOptions = ['active', 'paused', 'onboarding']
    .map((s) => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${s}</option>`)
    .join('');

  return layout(
    title,
    `
    <h2>${escapeHtml(title)}</h2>
    <a href="/admin/clients">&larr; Back to clients</a>
    ${errorHtml}
    <form method="POST" action="${action}" style="margin-top:1rem;">
      <div class="grid">
        <label>
          Business Name *
          <input type="text" name="businessName" value="${escapeHtml(v.businessName)}" required>
        </label>
        <label>
          Trade Type *
          <input type="text" name="tradeType" value="${escapeHtml(v.tradeType)}" required placeholder="e.g. Plumber, Electrician">
        </label>
      </div>
      <div class="grid">
        <label>
          County *
          <input type="text" name="county" value="${escapeHtml(v.county)}" required>
        </label>
        <label>
          WhatsApp Number *
          <input type="text" name="whatsappNumber" value="${escapeHtml(v.whatsappNumber)}" required placeholder="e.g. 447874494268">
        </label>
      </div>
      <div class="grid">
        <label>
          GBP Account ID
          <input type="text" name="gbpAccountId" value="${escapeHtml(v.gbpAccountId)}" placeholder="From Google Business Profile">
        </label>
        <label>
          GBP Location ID
          <input type="text" name="gbpLocationId" value="${escapeHtml(v.gbpLocationId)}" placeholder="From Google Business Profile">
        </label>
      </div>
      <label>
        Website Repo
        <input type="text" name="websiteRepo" value="${escapeHtml(v.websiteRepo)}" placeholder="e.g. owner/repo-name">
      </label>
      ${isEdit ? `<label>Status<select name="status">${statusOptions}</select></label>` : ''}
      <button type="submit">${isEdit ? 'Save Changes' : 'Add Client'}</button>
    </form>`,
  );
}
