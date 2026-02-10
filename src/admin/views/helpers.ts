const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

export function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    active: 'badge-success',
    paused: 'badge-warning',
    onboarding: 'badge-muted',
  };
  const cls = colors[status] ?? 'badge-muted';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

export function tokenStatusBadge(
  accessToken: string | null,
  expiresAt: number | Date | null,
): string {
  if (!accessToken) {
    return '<span class="badge badge-danger">Not connected</span>';
  }
  const expiryTs =
    expiresAt instanceof Date ? expiresAt.getTime() / 1000 : (expiresAt ?? 0);
  if (expiryTs < Date.now() / 1000) {
    return '<span class="badge badge-warning">Expired</span>';
  }
  return '<span class="badge badge-success">Connected</span>';
}

export function formatDate(date: Date | number | null): string {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date * 1000);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
