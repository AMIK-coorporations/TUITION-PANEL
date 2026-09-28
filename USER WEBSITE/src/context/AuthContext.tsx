// ============================================
// Auth Context
// Real email + password accounts (InsForge Auth) plus a per-account
// 6-digit security PIN gate.
//
// FLOW
//   signedOut -> LoginScreen (sign up / sign in)
//   signedIn  -> profile loaded -> PIN not set? -> PinSetup (create PIN)
//                                 -> PIN set?     -> PinGate  (enter PIN)
//   unlocked  -> dashboard
//
// The unlock state lives in React memory ONLY, so every full page load
// (including a refresh) requires the PIN again - which is the requested
// behaviour. No "remember me".
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { insforge } from '../lib/insforge';
import { invalidateActorCache } from '../services/db';
import { hashPin, isValidPin, verifyPinDigest, isSecureCryptoAvailable } from '../lib/crypto';
import {
  saveStoredSession,
  readStoredSession,
  clearStoredSession,
} from '../lib/authSessionStore';
import type { Teacher } from '../types/database';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type PinState = 'unknown' | 'needsSetup' | 'locked' | 'unlocked';

/** How many wrong PINs before the session is dropped. */
const MAX_PIN_ATTEMPTS = 5;

interface AuthContextValue {
  status: AuthStatus;
  /** The teacher profile bound to the signed-in account. */
  profile: Teacher | null;
  /** Supabase/InsForge auth user id. */
  userId: string | null;
  email: string | null;

  pinState: PinState;
  pinAttemptsLeft: number;

  /** True when the DB is missing the columns this app needs. */
  migrationRequired: boolean;
  error: string | null;
  initializing: boolean;

  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;

  createPin: (pin: string) => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;

  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isMissingColumnError(err: unknown): boolean {
  const message = String((err as { message?: string })?.message ?? '');
  return /column .* does not exist|Could not find the .* column/i.test(message);
}

function describeAuthError(err: unknown, fallback: string): string {
  const message = String((err as { message?: string })?.message ?? '').trim();
  if (!message) return fallback;
  // Make the common InsForge messages friendlier.
  if (/invalid login|invalid credentials|incorrect/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (/already registered|already exists|duplicate/i.test(message)) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (/password/i.test(message) && /(short|length|least|weak)/i.test(message)) {
    return message;
  }
  if (isMissingColumnError(err)) {
    return 'Database setup is incomplete. Run migrations/001_accounts_pin_and_rls.sql in InsForge.';
  }
  return message;
}

/** Minimal account shape this context needs from a session. */
interface SessionAccount {
  id: string;
  email: string | null;
  name: string | null;
}

/** Decode a JWT payload into readable claims, or null if not a JWT. */
function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    let payload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) return null;
    while (payload.length % 4 !== 0) payload += '=';
    const parsed = JSON.parse(atob(payload));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True for the project anon key (audience `anon`), false for user JWTs. */
function isAnonToken(claims: Record<string, unknown> | null): boolean {
  return !!claims && claims.aud === 'anon';
}

/** Read the identity claims (sub / email) straight out of the JWT. */
function accountFromToken(token: string): { id: string | null; email: string | null } {
  const claims = jwtClaims(token);
  return {
    id: typeof claims?.sub === 'string' ? claims.sub : null,
    email: typeof claims?.email === 'string' ? claims.email : null,
  };
}

/** HTTP status an SDK error carries, or 0 when the server never answered. */
function errorStatusCode(err: unknown): number {
  const code = (err as { statusCode?: unknown })?.statusCode;
  return typeof code === 'number' ? code : 0;
}

/** The bearer token the SDK's HTTP client is about to send (user token wins;
 *  falls back to the anon key, which callers must never persist). */
function currentBearer(): string | null {
  try {
    const header = insforge.getHttpClient().getHeaders()?.Authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    return token && !isAnonToken(jwtClaims(token)) ? token : null;
  } catch {
    return null;
  }
}

/**
 * "Who am I with this token?" - asked of the SERVER, which is the only
 * trustworthy answer after a page reload. The SDK's own getCurrentUser() in
 * browser mode only reads its in-memory session and never validates a restored
 * token, so it can never revive a dead page. Uses the same endpoint the SDK
 * itself hits internally: GET /api/auth/sessions/current; if that route is not
 * served to web clients (404), falls back to the profile endpoint for the
 * identity claim carried inside the JWT.
 *
 * rejected=true means the server explicitly refused the session (HTTP >= 400).
 * Transport failures (status 0) are NOT rejections - the token may be fine.
 */
async function probeSessionUser(
  token: string
): Promise<{ account: SessionAccount | null; rejected: boolean }> {
  const http = insforge.getHttpClient();
  try {
    const res = await http.get<unknown>('/api/auth/sessions/current', {
      skipAuthRefresh: true,
    });
    const user = (res as { user?: Record<string, unknown> | null } | null)?.user ?? null;
    if (!user || typeof user.id !== 'string') return { account: null, rejected: false };
    const profileName = (user.profile as { name?: unknown } | undefined)?.name;
    return {
      account: {
        id: user.id,
        email: typeof user.email === 'string' ? user.email : null,
        name: typeof profileName === 'string' ? profileName : null,
      },
      rejected: false,
    };
  } catch (err) {
    const code = errorStatusCode(err);
    if (code === 404) {
      // The route is not exposed to this client type; prove the session via
      // the profile endpoint using the id inside the token itself.
      const { id, email } = accountFromToken(token);
      if (id) {
        try {
          await http.get(`/api/auth/profiles/${encodeURIComponent(id)}`, {
            skipAuthRefresh: true,
          });
          return { account: { id, email, name: null }, rejected: false };
        } catch (err2) {
          return { account: null, rejected: errorStatusCode(err2) >= 400 };
        }
      }
      return { account: null, rejected: false };
    }
    // Only a real HTTP answer of >= 400 means the session is dead; 0 means
    // the request never got through (offline, DNS, timeout).
    return { account: null, rejected: code >= 400 };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Teacher | null>(null);
  const [pinState, setPinState] = useState<PinState>('unknown');
  const [pinAttemptsLeft, setPinAttemptsLeft] = useState(MAX_PIN_ATTEMPTS);
  const [migrationRequired, setMigrationRequired] = useState(false);
  // Mirrors `migrationRequired` so async callbacks can read it without a stale
  // closure value.
  const migrationRequiredRef = useRef(false);
  const markMigrationRequired = useCallback((value: boolean) => {
    migrationRequiredRef.current = value;
    setMigrationRequired(value);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Find the teacher profile for the account, creating it on first sign-in.
   * Returns null with migrationRequired=true when the schema is not ready.
   */
  const loadOrCreateProfile = useCallback(
    async (authUserId: string, displayName: string): Promise<Teacher | null> => {
      const { data, error: fetchError } = await insforge.database
        .from('teachers')
        .select('*')
        .eq('user_id', authUserId)
        .limit(1);

      if (fetchError) {
        if (isMissingColumnError(fetchError)) {
          markMigrationRequired(true);
          return null;
        }
        throw fetchError;
      }

      if (data && data.length > 0) {
        markMigrationRequired(false);
        return data[0] as Teacher;
      }

      // First sign-in for this account: create the teacher profile.
      const cleanName = displayName.trim() || 'Teacher';
      const { data: created, error: insertError } = await insforge.database
        .from('teachers')
        .insert([
          {
            name: cleanName,
            user_id: authUserId,
            theme_preference: 'system',
            custom_color_settings: null,
            is_admin: false,
          },
        ])
        .select();

      if (insertError) {
        if (isMissingColumnError(insertError)) {
          markMigrationRequired(true);
          return null;
        }
        throw insertError;
      }

      markMigrationRequired(false);
      return (created?.[0] as Teacher) ?? null;
    },
    [markMigrationRequired]
  );

  /** Apply a resolved profile to all the derived state. */
  const applyProfile = useCallback((next: Teacher | null) => {
    setProfile(next);
    if (!next) {
      setPinState('unknown');
      return;
    }
    // A profile with no PIN yet must create one before entering.
    setPinState(next.pin_hash ? 'locked' : 'needsSetup');
    setPinAttemptsLeft(MAX_PIN_ATTEMPTS);
  }, []);

  /** Restore an existing session on first mount. */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        // 1. Server truth first: any token we persisted at sign-in is
        // re-validated against /api/auth/sessions/current. The SDK cannot do
        // this itself in browser mode (getCurrentUser only reads memory and
        // never sends the restored token), which is why reloads bounced every
        // teacher to the login screen before.
        const stored = readStoredSession();
        let account: SessionAccount | null = null;

        if (stored) {
          insforge.setAccessToken(stored.accessToken);
          const http = insforge.getHttpClient();

          // A stored refresh token (only when the backend returned one in the
          // body) lets an expired access token be renewed over the body-based
          // mobile refresh flow. The SDK's getValidAccessToken() does exactly
          // that when its client holds a refresh token.
          let effectiveAccess = stored.accessToken;
          if (stored.refreshToken) {
            try {
              http.setRefreshToken(stored.refreshToken);
              const fresh = await http.getValidAccessToken();
              if (fresh && fresh !== stored.accessToken) {
                effectiveAccess = fresh;
                insforge.setAccessToken(fresh);
              }
            } catch {
              // Refresh failed; the probe below judges the stored token.
            }
          }

          const probe = await probeSessionUser(effectiveAccess);
          if (probe.account) {
            account = probe.account;
            if (effectiveAccess !== stored.accessToken) {
              saveStoredSession({ userId: account.id, accessToken: effectiveAccess });
            }
          } else if (probe.rejected) {
            // The server said this session is dead - drop it for good.
            clearStoredSession();
          }
          // Not rejected, just unreachable (offline?): stay signed out for
          // this load but keep the token for the next one.
        }

        // 2. No durable token at all: fall back to the SDK's own cookie
        // session. Cross-origin dev cannot use it; a same-origin production
        // deploy can, so this is worth the one extra call.
        if (!account && !stored) {
          const { data, error: userError } = await insforge.auth.getCurrentUser();
          if (!userError && data?.user) {
            const u = data.user;
            account = {
              id: u.id,
              email: u.email ?? null,
              name: u.profile?.name ?? null,
            };
            // Mirror the cookie session into the durable store so later
            // reloads take the fast, proven path above. currentBearer()
            // refuses to persist the anon key by mistake.
            const token = currentBearer();
            if (token) saveStoredSession({ userId: account.id, accessToken: token });
          }
        }

        if (cancelled) return;

        if (!account || (!account.email && !account.id)) {
          // Show the login screen. Deliberately NOT clearing the durable
          // store here: a rejected token was already cleared above, and when
          // nothing was stored there is nothing to clear. Keeping a token the
          // probe simply could not reach (e.g. an offline reload) lets the
          // next load restore it.
          setStatus('signedOut');
          return;
        }

        setUserId(account.id);
        setEmail(account.email);

        const resolved = await loadOrCreateProfile(
          account.id,
          account.name || account.email?.split('@')[0] || 'Teacher'
        );
        if (cancelled) return;

        if (resolved) {
          invalidateActorCache();
          applyProfile(resolved);
          setStatus('signedIn');
        } else if (migrationRequiredRef.current) {
          // Schema not ready - show the migration instructions.
          setStatus('signedIn');
          setPinState('unknown');
        } else {
          // The profile could not be created or found for a reason other than
          // a missing column. Staying "signedIn" with no profile would spin
          // forever on the loading splash, so fail back to the login screen
          // with an explanation instead.
          setError(
            'We signed you in but could not load your teacher profile. Please try signing in again.'
          );
          setStatus('signedOut');
          setPinState('unknown');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Session restore failed:', err);
          setStatus('signedOut');
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadOrCreateProfile, applyProfile]);

  // ---------------------------------------------------------------
  // Sign up / in / out
  // ---------------------------------------------------------------

  const signUp = useCallback(
    async (nextEmail: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      try {
        const { data, error: signUpError } = await insforge.auth.signUp({
          email: nextEmail.trim(),
          password,
          name: name.trim(),
        });
        if (signUpError) throw signUpError;

        // Some InsForge projects require email verification before a session
        // exists. In that case signUp returns a user but no usable session.
        const signedInUser = data?.user;
        if (!signedInUser) {
          setError(
            'Account created. Please check your email to verify it, then sign in.'
          );
          return false;
        }
        if (data?.accessToken) {
          saveStoredSession({
            userId: signedInUser.id,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        }

        // Try to establish a session straight away.
        // NOTE: the SDK type is a discriminated union whose password branch
        // requires `method: 'password'` explicitly.
        const { data: sessionData, error: signInError } =
          await insforge.auth.signInWithPassword({
            method: 'password',
            email: nextEmail.trim(),
            password,
          });

        if (signInError) {
          setError(
            'Account created. Please verify your email (if required) and sign in.'
          );
          return false;
        }
        if (sessionData?.accessToken) {
          saveStoredSession({
            userId: sessionData.user.id,
            accessToken: sessionData.accessToken,
            refreshToken: sessionData.refreshToken,
          });
        }

        setUserId(signedInUser.id);
        setEmail(signedInUser.email ?? nextEmail.trim());

        const resolved = await loadOrCreateProfile(
          signedInUser.id,
          name || signedInUser.profile?.name || nextEmail.split('@')[0]
        );
        invalidateActorCache();

        // Only stay `signedIn` when there is something to render. Otherwise the
        // guard would sit on the loading splash forever.
        if (!resolved && !migrationRequiredRef.current) {
          setError(
            'Your account was created but the teacher profile could not be set up. Please sign in to finish setup.'
          );
          setStatus('signedOut');
          setPinState('unknown');
          return false;
        }

        applyProfile(resolved);
        setStatus('signedIn');
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(describeAuthError(err, 'Could not create the account.'));
        }
        return false;
      }
    },
    [loadOrCreateProfile, applyProfile]
  );

  const signIn = useCallback(
    async (nextEmail: string, password: string): Promise<boolean> => {
      setError(null);
      try {
        const { data, error: signInError } = await insforge.auth.signInWithPassword({
          method: 'password',
          email: nextEmail.trim(),
          password,
        });
        if (signInError) throw signInError;

        const user = data?.user;
        if (!user) {
          setError('Sign in failed. Please try again.');
          return false;
        }
        // Persist so a page reload can restore this session (see lib/authSessionStore).
        if (data?.accessToken) {
          saveStoredSession({
            userId: user.id,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        }

        setUserId(user.id);
        setEmail(user.email ?? nextEmail.trim());

        const resolved = await loadOrCreateProfile(
          user.id,
          user.profile?.name || nextEmail.split('@')[0]
        );
        invalidateActorCache();

        if (!resolved && !migrationRequiredRef.current) {
          setError(
            'We signed you in but could not load your teacher profile. Please try signing in again.'
          );
          setStatus('signedOut');
          setPinState('unknown');
          return false;
        }

        applyProfile(resolved);
        setStatus('signedIn');
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(describeAuthError(err, 'Sign in failed.'));
        }
        return false;
      }
    },
    [loadOrCreateProfile, applyProfile]
  );

  const signOut = useCallback(async () => {
    try {
      await insforge.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      clearStoredSession();
      invalidateActorCache();
      // Unlock state is intentionally discarded: the PIN is required again.
      setStatus('signedOut');
      setUserId(null);
      setEmail(null);
      setProfile(null);
      setPinState('unknown');
      setPinAttemptsLeft(MAX_PIN_ATTEMPTS);
      setError(null);
    }
  }, []);

  // ---------------------------------------------------------------
  // PIN
  // ---------------------------------------------------------------

  const createPin = useCallback(
    async (pin: string): Promise<boolean> => {
      setError(null);
      if (!profile) {
        setError('No teacher profile is loaded.');
        return false;
      }
      if (!isValidPin(pin)) {
        setError('The PIN must be exactly 6 digits.');
        return false;
      }
      if (!isSecureCryptoAvailable()) {
        setError(
          'This browser cannot hash the PIN because the page is not secure. Use HTTPS or localhost.'
        );
        return false;
      }

      try {
        const digest = await hashPin(pin);
        const { data, error: updateError } = await insforge.database
          .from('teachers')
          .update({
            pin_hash: digest.hash,
            pin_salt: digest.salt,
            pin_iterations: digest.iterations,
            pin_set_at: new Date().toISOString(),
          })
          .eq('id', profile.id)
          .select();

        if (updateError) throw updateError;

        const updated = (data?.[0] as Teacher) ?? {
          ...profile,
          pin_hash: digest.hash,
          pin_salt: digest.salt,
          pin_iterations: digest.iterations,
        };
        setProfile(updated);
        // Creating the PIN also unlocks the current session.
        setPinState('unlocked');
        setPinAttemptsLeft(MAX_PIN_ATTEMPTS);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(describeAuthError(err, 'Could not save the PIN.'));
        }
        return false;
      }
    },
    [profile]
  );

  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      setError(null);
      if (!profile) return false;

      if (!isValidPin(pin)) {
        setError('Enter all 6 digits.');
        return false;
      }

      const ok = await verifyPinDigest(
        pin,
        profile.pin_hash,
        profile.pin_salt,
        profile.pin_iterations
      );

      if (ok) {
        setPinState('unlocked');
        setPinAttemptsLeft(MAX_PIN_ATTEMPTS);
        setError(null);
        return true;
      }

      const left = pinAttemptsLeft - 1;
      setPinAttemptsLeft(left);

      if (left <= 0) {
        setError('Too many incorrect PIN attempts. Please sign in again.');
        await signOut();
        return false;
      }

      setError(`Incorrect PIN. ${left} attempt${left === 1 ? '' : 's'} remaining.`);
      return false;
    },
    [profile, pinAttemptsLeft, signOut]
  );

  const changePin = useCallback(
    async (currentPin: string, newPin: string): Promise<boolean> => {
      setError(null);
      if (!profile) return false;

      const ok = await verifyPinDigest(
        currentPin,
        profile.pin_hash,
        profile.pin_salt,
        profile.pin_iterations
      );
      if (!ok) {
        setError('The current PIN is incorrect.');
        return false;
      }
      return createPin(newPin);
    },
    [profile, createPin]
  );

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const resolved = await loadOrCreateProfile(
        userId,
        profile?.name || email?.split('@')[0] || 'Teacher'
      );
      if (resolved) {
        invalidateActorCache();
        applyProfile(resolved);
      }
    } catch (err) {
      console.warn('Profile refresh failed:', err);
    }
  }, [userId, profile, email, loadOrCreateProfile, applyProfile]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      userId,
      email,
      pinState,
      pinAttemptsLeft,
      migrationRequired,
      error,
      initializing,
      signUp,
      signIn,
      signOut,
      createPin,
      unlockWithPin,
      changePin,
      refreshProfile,
      clearError,
    }),
    [
      status,
      profile,
      userId,
      email,
      pinState,
      pinAttemptsLeft,
      migrationRequired,
      error,
      initializing,
      signUp,
      signIn,
      signOut,
      createPin,
      unlockWithPin,
      changePin,
      refreshProfile,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
