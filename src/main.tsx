import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { renderStartupError } from './fatalStartupError';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Check index.html for <div id="root">.');
}

// The App graph is loaded dynamically so a module-level startup failure (for
// example a missing production API origin, which intentionally fails closed)
// is reported in the page instead of leaving a blank screen. Route guards,
// authentication, and refresh behavior are unchanged: on failure nothing
// renders except the startup message.
async function start(root: HTMLElement): Promise<void> {
  try {
    const { App } = await import('./app/App');
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    renderStartupError(root, error);
  }
}

void start(rootElement);
