/**
 * Last-resort startup failure UI. Used only when the application module graph
 * itself cannot load (for example a missing production API origin, which
 * intentionally fails closed). Rendered with inline styles so the message is
 * visible even if stylesheets fail to load. Shows the error message only —
 * never stacks, tokens, or route internals.
 */
export function startupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The application could not be started.';
}

export function renderStartupError(root: HTMLElement, error: unknown): void {
  root.innerHTML = '';
  const container = document.createElement('div');
  container.setAttribute('role', 'alert');
  container.style.cssText =
    'min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:#fafafa;color:#111;font-family:system-ui,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText =
    'max-width:28rem;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;text-align:center;';
  const title = document.createElement('p');
  title.style.cssText = 'font-weight:600;font-size:14px;margin:0 0 8px;';
  title.textContent = 'Application failed to start';
  const detail = document.createElement('p');
  detail.style.cssText = 'font-size:13px;color:#555;margin:0;';
  detail.textContent = startupErrorMessage(error);
  card.appendChild(title);
  card.appendChild(detail);
  container.appendChild(card);
  root.appendChild(container);
}
