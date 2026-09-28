// ============================================
// branding.ts - the single source of the app logo.
//
// The logo file lives in the project root ("APP LOGO.png"). Importing it
// through Vite gives us a URL that works in dev AND after `npm run build`
// (Vite hashes and copies it into dist/assets), so nothing needs to be
// duplicated into the public folder.
//
// NOTE: public/logo.png + public/favicon.svg + public/favicon-32.png are
// REGENERATED from this source file by scripts/make-logo.mjs (transparent
// background, resized) every time you run `npm run dev` or `npm run build`.
// ============================================

import appLogoUrl from '../APP LOGO.png';

export const appLogo = appLogoUrl;

/**
 * Make sure the tab icon exists even if index.html's static links were
 * removed. Prefers the generated transparent SVG favicon in public/ and
 * falls back to the bundled original PNG. The original /favicon.svg from
 * the template stays as the pre-JavaScript fallback for the very first paint.
 */
export function applyFavicon() {
  try {
    // If index.html already declares an icon we keep it (it points at the
    // generated /favicon.svg). Only inject one when nothing is declared.
    if (document.querySelector('link[rel~="icon"]')) return;

    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = '/favicon.svg';
    document.head.appendChild(icon);

    const fallback = document.createElement('link');
    fallback.rel = 'icon';
    fallback.type = 'image/png';
    fallback.href = appLogo;
    document.head.appendChild(fallback);
  } catch {
    // Favicon is cosmetic; never block app startup over it.
  }
}