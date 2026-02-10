export function loginPage(error?: string): string {
  const errorHtml = error
    ? `<div role="alert" style="background:#f8d7da;color:#721c24;padding:1rem;border-radius:4px;margin-bottom:1rem;border:1px solid #f5c6cb;">${error}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login - LocalEngine Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
</head>
<body>
  <main class="container" style="max-width:400px;margin-top:10vh;">
    <hgroup>
      <h2>LocalEngine Admin</h2>
      <p>Sign in to manage your clients</p>
    </hgroup>
    ${errorHtml}
    <form method="POST" action="/admin/login">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autofocus>
      <button type="submit">Sign In</button>
    </form>
  </main>
</body>
</html>`;
}
