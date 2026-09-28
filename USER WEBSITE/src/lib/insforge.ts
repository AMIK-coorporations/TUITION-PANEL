// ============================================
// InsForge Client - TUITION PANEL
// ============================================

import { createClient } from '@insforge/sdk';
import type { InsForgeClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL;
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

/**
 * True when both required environment variables are present.
 *
 * This is checked BEFORE rendering (see main.tsx) so a missing `.env` shows a
 * readable setup message instead of a blank white page. Previously this module
 * threw during import, which aborted the whole bundle with no visible reason.
 */
export const isInsforgeConfigured = Boolean(insforgeUrl && insforgeAnonKey);

function createUnconfiguredClient(): InsForgeClient {
  // A stub that reports the real problem the moment anything tries to use it,
  // rather than crashing at import time. main.tsx gates rendering on
  // isInsforgeConfigured, so this only matters if a module imports `insforge`
  // outside that gate.
  //
  // Property access itself throws - NOT a "function that throws when called".
  // A callable trap was invisible to code such as
  // `try { await client.getHttpClient() } catch {}`, which silently swallowed
  // the configuration error and made misconfigured-deploy bugs undiagnosable.
  return new Proxy({} as InsForgeClient, {
    get(_target, property) {
      throw new Error(
        `InsForge is not configured ("${String(
          property
        )}" was requested). Copy .env.example to .env and set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY, then restart the dev server.`
      );
    },
  });
}

export const insforge: InsForgeClient = isInsforgeConfigured
  ? createClient({
      baseUrl: insforgeUrl,
      anonKey: insforgeAnonKey,
    })
  : createUnconfiguredClient();

/** The configuration message shown when the app cannot start. */
export const CONFIG_ERROR_MESSAGE =
  'Missing InsForge configuration. Copy .env.example to .env, set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY, then restart the dev server.';