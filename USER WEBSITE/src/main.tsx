import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { isInsforgeConfigured, CONFIG_ERROR_MESSAGE } from './lib/insforge';
import { appLogo, applyFavicon } from './branding';

// Browser tab icon = the real app logo (works in dev and production build).
applyFavicon();

const rootElement = document.getElementById('root');

/**
 * Render a plain, readable setup message instead of a blank white page when
 * the environment file is missing. This is the single most common first-run
 * problem, and previously it failed with no visible explanation.
 */
function renderConfigError(message: string) {
  if (!rootElement) return;
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:Inter,system-ui,-apple-system,sans-serif;">
      <div style="max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 16px 48px rgba(0,0,0,.12);">
        <div style="width:56px;height:56px;margin-bottom:16px;"><img src="/logo.png" onerror="this.onerror=null;this.src='${appLogo}';" alt="Tuition Panel logo" style="width:100%;height:100%;object-fit:contain;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px;"></div>
        <h1 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px;">Setup required</h1>
        <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 16px;">${message}</p>
        <pre style="background:#f1f5f9;border-radius:12px;padding:12px;font-size:12px;color:#334155;overflow-x:auto;margin:0;">VITE_INSFORGE_URL=https://your-project.region.insforge.app
VITE_INSFORGE_ANON_KEY=your-anon-key</pre>
        <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">See <code>.env.example</code> in the project root for the full template.</p>
      </div>
    </div>`;
}

if (!rootElement) {
  throw new Error('Root element #root was not found in index.html.');
}

if (!isInsforgeConfigured) {
  renderConfigError(CONFIG_ERROR_MESSAGE);
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}