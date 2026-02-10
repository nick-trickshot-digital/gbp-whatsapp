import { escapeHtml } from './helpers.js';

export function layout(title: string, content: string, flash?: { type: string; message: string }): string {
  const flashHtml = flash
    ? `<div role="alert" class="flash flash-${escapeHtml(flash.type)}">${escapeHtml(flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - LocalEngine Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 600; }
    .badge-success { background: #2ecc40; color: white; }
    .badge-warning { background: #ffdc00; color: #333; }
    .badge-danger { background: #ff4136; color: white; }
    .badge-muted { background: #aaa; color: white; }
    nav { margin-bottom: 2rem; }
    .flash { padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
    .flash-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .flash-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .actions { display: flex; gap: 0.5rem; align-items: center; }
    .actions a, .actions button { margin: 0; padding: 0.3rem 0.6rem; font-size: 0.85rem; }
    table { font-size: 0.9rem; }
    .star { color: #f1c40f; }
    .text-muted { color: #6c757d; }
    pre.review-text { white-space: pre-wrap; font-family: inherit; font-size: 0.85rem; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <main class="container">
    <nav>
      <ul>
        <li><strong>LocalEngine Admin</strong></li>
      </ul>
      <ul>
        <li><a href="/admin/clients">Clients</a></li>
        <li><a href="/admin/activity">Activity</a></li>
        <li><a href="/admin/reviews">Reviews</a></li>
        <li><a href="/admin/logout">Logout</a></li>
      </ul>
    </nav>
    ${flashHtml}
    ${content}
  </main>
</body>
</html>`;
}
