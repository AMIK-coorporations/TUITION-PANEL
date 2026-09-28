// ============================================
// PinSetupScreen - first-time 6-digit PIN creation
// Shown once per account, right after the first sign-in.
// ============================================

import { useState } from 'react';
import { ShieldCheck, Lock, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';
import BrandLogo from '../BrandLogo';
import PinInput from './PinInput';
import { PIN_LENGTH } from '../../lib/crypto';

export default function PinSetupScreen() {
  const { createPin, signOut, profile, error, clearError } = useAuth();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFirstComplete = (pin: string) => {
    setFirstPin(pin);
    setLocalError(null);
    clearError();
    setStep('confirm');
  };

  const handleConfirmComplete = async (pin: string) => {
    if (pin !== firstPin) {
      setLocalError('The two PINs do not match. Please start again.');
      setConfirmPin('');
      setFirstPin('');
      setStep('create');
      return;
    }

    setBusy(true);
    setLocalError(null);
    clearError();
    try {
      await createPin(pin);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep('create');
    setFirstPin('');
    setConfirmPin('');
    setLocalError(null);
    clearError();
  };

  const message = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-100 via-surface-50 to-primary-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo className="w-16 h-16 mx-auto rounded-3xl bg-white shadow-glow ring-1 ring-black/5 p-2 mb-4" />
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">
            Create Your Security PIN
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {profile ? `Welcome, ${profile.name}. ` : ''}
            Set a 6-digit PIN you will enter each time you open the dashboard.
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div
              className={`h-1.5 w-16 rounded-full ${step === 'create' ? 'bg-primary-500' : 'bg-emerald-500'}`}
            />
            <div
              className={`h-1.5 w-16 rounded-full ${step === 'confirm' ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'}`}
            />
          </div>

          {message && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex gap-2.5">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{message}</p>
            </div>
          )}

          {step === 'create' ? (
            <div className="space-y-6">
              <PinInput
                key="create"
                id="pin-create"
                label={`Choose a ${PIN_LENGTH}-digit PIN`}
                value={firstPin}
                onChange={setFirstPin}
                onComplete={handleFirstComplete}
                autoFocus
                disabled={busy}
              />
              <p className="text-[11px] text-surface-400 text-center leading-relaxed">
                Choose 6 digits you will remember. Avoid 123456 or your birth date. The PIN is
                stored only as a secure hash — it cannot be read back out.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <PinInput
                key="confirm"
                id="pin-confirm"
                label={`Re-enter your ${PIN_LENGTH}-digit PIN`}
                value={confirmPin}
                onChange={setConfirmPin}
                onComplete={handleConfirmComplete}
                autoFocus
                disabled={busy}
                error={Boolean(localError)}
              />

              {busy && (
                <p className="text-xs text-center text-surface-400">Saving your PIN…</p>
              )}

              <button
                type="button"
                onClick={restart}
                disabled={busy}
                className="w-full text-xs text-surface-400 hover:text-surface-600 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ArrowLeft size={12} /> Start over
              </button>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-surface-200 dark:border-surface-700 space-y-3">
            <div className="flex items-start gap-2 text-[11px] text-surface-400">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>
                You will be asked for this PIN every time the dashboard loads. It is a screen lock
                on top of your account password.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full text-xs text-surface-400 hover:text-rose-500 flex items-center justify-center gap-1.5"
            >
              <LogOut size={12} /> Sign out instead
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-surface-400 mt-5 flex items-center justify-center gap-1.5">
          <Lock size={11} /> PIN secured with PBKDF2-SHA256
        </p>
      </div>
    </div>
  );
}