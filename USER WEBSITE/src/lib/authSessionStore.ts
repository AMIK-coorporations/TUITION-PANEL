// ============================================
// Durable auth-session storage for reload / reopen
//
// The InsForge SDK keeps its access token in MEMORY ONLY (its TokenManager is
// literally "Memory-only token storage"), and in browser mode getCurrentUser()
// never re-validates over the network - the only restore path is the httpOnly
// refresh cookie, which cannot cross origins (dev server on localhost talks to
// https://<region>.insforge.app). Result: every reload looked "signed out" and
// bounced teachers to the sign-in screen.
//
// We therefore persist the access token ourselves and validate it against
// GET /api/auth/sessions/current through the SDK's public HTTP client.
//
// Threat-model note: tokens in localStorage are readable by any XSS on this
// origin. This app's security boundary is deliberate: the token keeps the
// ACCOUNT alive, while the 6-digit PIN - held in React memory only - gates
// every dashboard open. A token thief still cannot pass the PIN screen.
// ============================================

const STORAGE_KEY = 'insfor…sion';
/** Treat the token as dead 30s before it actually expires. */
const EXPIRY_LEEWAY_MS = 30_000;

export interface StoredSession {
  /** Bound to the owning account so a stale token can never log a *different*
   *  user back in without the server agreeing. */
  userId: string;
  accessToken: string;
  /** Only present if the backend returned one in the body (mobile flow); the
   *  web flow keeps it in an httpOnly cookie we cannot read. */
  refreshToken?: string;
}

/** Read the `exp` claim (ms epoch) out of a JWT, or null if undecodable. */
function tokenExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4 !== 0) payload += '=';
    const claims = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Persist a freshly issued session. A previously stored refresh token is kept
 * ONLY when it belongs to the same account.
 */
export function saveStoredSession(session: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
}): void {
  try {
    let carryRefresh: string | undefined;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const previous = raw ? (JSON.parse(raw) as StoredSession) : null;
      if (previous && previous.userId === session.userId && previous.refreshToken) {
        carryRefresh = previous.refreshToken;
      }
    } catch {
      // Ignore an unreadable previous entry.
    }

    const next: StoredSession = {
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? carryRefresh,
    };
    const raw = JSON.stringify(next);
    sessionStorage.setItem(STORAGE_KEY, raw);
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Private mode / storage disabled: the in-memory session still works for
    // this page view; a reload will correctly show the login screen.
  }
}

/**
 * The stored session, or null when there is none, it is unreadable, or the
 * access token is already expired (in which case it is cleared).
 */
export function readStoredSession(): StoredSession | null {
  const parse = (raw: string | null): StoredSession | null => {
    if (!raw) return null;
    try {
      const candidate = JSON.parse(raw) as StoredSession;
      if (
        candidate &&
        typeof candidate.userId === 'string' &&
        typeof candidate.accessToken === 'string' &&
        candidate.accessToken.length > 0
      ) {
        return candidate;
      }
    } catch {
      // Fall through: unreadable.
    }
    return null;
  };

  let fromSession: StoredSession | null = null;
  let fromLocal: StoredSession | null = null;
  try {
    fromSession = parse(sessionStorage.getItem(STORAGE_KEY));
    fromLocal = parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }

  // Two tabs of the same account can hold copies with different freshness
  // (a sign-in elsewhere only rewrites both at once, but keep the newest
  // token anyway): pick the entry whose access token expires later.
  const ranked = (s: StoredSession): number => {
    const exp = tokenExpiryMs(s.accessToken);
    return exp ?? 0;
  };
  let parsed: StoredSession | null = null;
  if (fromSession && fromLocal) {
    parsed = ranked(fromLocal) > ranked(fromSession) ? fromLocal : fromSession;
  } else {
    parsed = fromSession ?? fromLocal;
  }

  if (!parsed) {
    if (fromSession || fromLocal) clearStoredSession();
    return null;
  }

  const expiry = tokenExpiryMs(parsed.accessToken);
  if (expiry !== null && Date.now() >= expiry - EXPIRY_LEEWAY_MS) {
    // Expired: keep the entry only if there is a refresh token that could
    // mint a new access token; otherwise the whole session is dead.
    if (parsed.refreshToken) return parsed;
    clearStoredSession();
    return null;
  }
  return parsed;
}

export function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
