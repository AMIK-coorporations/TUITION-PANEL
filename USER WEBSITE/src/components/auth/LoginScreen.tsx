// ============================================
// LoginScreen - Email + password sign in / sign up
// Replaces the old "Who are you?" teacher picker.
// ============================================

import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';
import BrandLogo from '../BrandLogo';

type Mode = 'signin' | 'signup';

export default function LoginScreen({ initialError }: { initialError?: string | null }) {
  const { signIn, signUp, error, clearError } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setLocalError(null);
    clearError();
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setLocalError('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('The two passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      const ok =
        mode === 'signin'
          ? await signIn(cleanEmail, password)
          : await signUp(cleanEmail, password, name);
      if (!ok) {
        // The provider's message is surfaced via `error`.
      }
    } finally {
      setBusy(false);
    }
  };

  const message = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-100 via-surface-50 to-primary-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <BrandLogo className="w-16 h-16 mx-auto rounded-3xl bg-white shadow-glow ring-1 ring-black/5 p-2 mb-4" />
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">TUITION PANEL</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your teacher account'}
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8">
          {/* Mode switcher */}
          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {message && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex gap-2.5">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {initialError && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 text-xs flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{initialError}</span>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="input-label">
                  Full Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
                  />
                  <input
                    id="auth-name"
                    type="text"
                    className="input pl-10"
                    placeholder="e.g. Sir Ahmed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="input-label">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
                />
                <input
                  id="auth-email"
                  type="email"
                  className="input pl-10"
                  placeholder="teacher@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="input-label">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-confirm" className="input-label">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
                  />
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3"
              loading={busy}
              disabled={busy}
            >
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {mode === 'signup' && (
            <p className="text-[11px] text-surface-400 mt-4 text-center leading-relaxed">
              After creating your account you will set a 6-digit security PIN. You will be asked
              for it every time you open the dashboard.
            </p>
          )}

          <div className="mt-6 pt-5 border-t border-surface-200 dark:border-surface-700 flex items-center gap-2 text-[11px] text-surface-400">
            <ShieldCheck size={14} className="shrink-0" />
            <span>
              Accounts are secured by InsForge. A 6-digit PIN protects your dashboard on every
              visit.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}