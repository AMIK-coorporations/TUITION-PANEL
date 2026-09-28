// ============================================
// PinGateScreen - 6-digit PIN required on every dashboard open
// The unlock state lives in memory only, so a page refresh locks again.
// ============================================

import { useState } from 'react';
import { LogOut, AlertTriangle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';
import BrandLogo from '../BrandLogo';
import PinInput from './PinInput';
import { PIN_LENGTH } from '../../lib/crypto';

export default function PinGateScreen() {
  const { unlockWithPin, signOut, profile, error, clearError, pinAttemptsLeft } = useAuth();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const handleComplete = async (value: string) => {
    setBusy(true);
    clearError();
    try {
      const ok = await unlockWithPin(value);
      if (!ok) {
        // Clear so the user can retry immediately.
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-100 via-surface-50 to-primary-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo className="w-16 h-16 mx-auto rounded-3xl bg-white shadow-glow ring-1 ring-black/5 p-2 mb-4" />
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">Enter Your PIN</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Your dashboard is locked. Enter your {PIN_LENGTH}-digit PIN to continue.
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8">
          {profile && (
            <div className="flex items-center justify-center gap-2 mb-6 pb-5 border-b border-surface-200 dark:border-surface-700">
              <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-950/50 flex items-center justify-center text-primary-600 dark:text-primary-300">
                <User size={15} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 leading-tight">
                  {profile.name}
                </p>
                <p className="text-[10px] text-surface-400">Signed in</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex gap-2.5">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}

          <PinInput
            id="pin-gate"
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            autoFocus
            disabled={busy}
            error={Boolean(error)}
          />

          {busy && <p className="text-xs text-center text-surface-400 mt-4">Verifying…</p>}

          {pinAttemptsLeft < 5 && !busy && (
            <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 mt-4">
              {pinAttemptsLeft} attempt{pinAttemptsLeft === 1 ? '' : 's'} remaining before you are
              signed out.
            </p>
          )}

          <div className="mt-6 pt-5 border-t border-surface-200 dark:border-surface-700">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void signOut()}
            >
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </div>

        <p className="text-center text-[11px] text-surface-400 mt-5">
          The PIN is required on every visit, including page refreshes.
        </p>
      </div>
    </div>
  );
}