// ============================================
// Crypto helpers - PIN hashing and safe comparison
// Uses Web Crypto (PBKDF2-HMAC-SHA256).
// ============================================

const encoder = new TextEncoder();

/** Cost factor for the 6-digit PIN digest. */
export const PBKDF2_ITERATIONS = 150_000;

/** The PIN is exactly this many digits. */
export const PIN_LENGTH = 6;

/**
 * Web Crypto is only exposed in a secure context: HTTPS, or localhost.
 * On a plain-HTTP page (e.g. http://192.168.x.x) it is undefined and PINs
 * cannot be hashed. Callers surface a clear message instead of failing weirdly.
 */
export function isSecureCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  );
}

export function assertCryptoAvailable(): void {
  if (!isSecureCryptoAvailable()) {
    throw new Error(
      'Secure crypto is unavailable in this browser context. Open the app over HTTPS or on localhost.'
    );
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

// `Uint8Array<ArrayBuffer>` (not the default `ArrayBufferLike`) so the result
// is assignable to Web Crypto's `BufferSource`, which rejects SharedArrayBuffer
// views in the newer DOM typings shipped with this TypeScript version.
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    out[i] = Number.isNaN(byte) ? 0 : byte;
  }
  return out;
}

/** Cryptographically random hex string. */
export function randomHex(byteLength = 16): string {
  assertCryptoAvailable();
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Unique id for UI keys / toast ids.
 * `crypto.randomUUID` is secure-context only, so fall back when unavailable.
 */
export function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Length-independent, value-constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function derivePin(pin: string, saltHex: string, iterations: number): Promise<string> {
  assertCryptoAvailable();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export interface PinDigest {
  hash: string;
  salt: string;
  iterations: number;
}

/** Derive a fresh salted digest for a new PIN. The PIN is never stored. */
export async function hashPin(pin: string): Promise<PinDigest> {
  if (!isValidPin(pin)) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits.`);
  }
  const salt = randomHex(16);
  const hash = await derivePin(pin, salt, PBKDF2_ITERATIONS);
  return { hash, salt, iterations: PBKDF2_ITERATIONS };
}

/** Recompute and compare. Returns false rather than throwing on bad input. */
export async function verifyPinDigest(
  pin: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined,
  storedIterations: number | null | undefined
): Promise<boolean> {
  if (!isValidPin(pin) || !storedHash || !storedSalt) return false;
  const iterations =
    typeof storedIterations === 'number' && storedIterations > 0
      ? storedIterations
      : PBKDF2_ITERATIONS;
  try {
    const computed = await derivePin(pin, storedSalt, iterations);
    return timingSafeEqual(computed, storedHash);
  } catch {
    return false;
  }
}
