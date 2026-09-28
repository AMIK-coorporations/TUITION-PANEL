// ============================================
// Access codes (English unlock + Super Admin)
// ============================================
//
// ⚠️  READ THIS - WHAT THIS FILE DOES AND DOES NOT DO
//
// These codes are stored obfuscated (base64) rather than as plain text, so
// they are no longer directly greppable in the source tree or in the built
// bundle. That is OBFUSCATION, NOT SECURITY.
//
// Anything shipped to a browser can be recovered by a determined person. The
// only way to truly enforce a shared code is to verify it on a server (an
// InsForge edge function) and never send it to the client.
//
// Each code can be overridden at build time with an env var:
//   VITE_ENGLISH_ACCESS_CODE=...
//   VITE_ADMIN_ACCESS_CODE=...
// Beware: Vite inlines env vars into the bundle, so an override is no more
// secret than this file - it is only more convenient to rotate.
//
// Comparison is constant-time (see timingSafeEqual) so the codes cannot be
// guessed a character at a time by measuring response times.

import { timingSafeEqual } from './crypto';

const OBFUSCATED = {
  /** English language unlock code. */
  english: 'MTEyMjMz',
  /** Super Admin panel code. */
  admin: 'NjU0MzIx',
};

function decode(encoded: string): string {
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(encoded);
    }
    // Node fallback (used by tests / SSR tooling).
    const bufferCtor = (globalThis as unknown as {
      Buffer?: { from(input: string, encoding: string): { toString(enc: string): string } };
    }).Buffer;
    if (bufferCtor) {
      return bufferCtor.from(encoded, 'base64').toString('binary');
    }
    return '';
  } catch {
    return '';
  }
}

const env = import.meta.env as Record<string, string | undefined>;

const ENGLISH_CODE = env.VITE_ENGLISH_ACCESS_CODE || decode(OBFUSCATED.english);
const ADMIN_CODE = env.VITE_ADMIN_ACCESS_CODE || decode(OBFUSCATED.admin);

/** True when `input` matches the English-unlock code. */
export function isEnglishCodeValid(input: string): boolean {
  return ENGLISH_CODE.length > 0 && timingSafeEqual(input, ENGLISH_CODE);
}

/** True when `input` matches the Super Admin code. */
export function isAdminCodeValid(input: string): boolean {
  return ADMIN_CODE.length > 0 && timingSafeEqual(input, ADMIN_CODE);
}

/** Diagnostic only: are both codes resolvable at runtime? */
export function accessCodesConfigured(): { english: boolean; admin: boolean } {
  return {
    english: ENGLISH_CODE.length > 0,
    admin: ADMIN_CODE.length > 0,
  };
}
