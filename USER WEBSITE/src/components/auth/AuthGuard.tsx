// ============================================
// AuthGuard - gates the whole application behind
// account sign-in and the 6-digit PIN.
//
//   loading        -> splash
//   signed out     -> LoginScreen
//   schema missing -> MigrationRequiredScreen
//   no PIN yet     -> PinSetupScreen
//   PIN not entered-> PinGateScreen
//   unlocked       -> the app
// ============================================

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../BrandLogo';
import LoginScreen from './LoginScreen';
import PinSetupScreen from './PinSetupScreen';
import PinGateScreen from './PinGateScreen';
import MigrationRequiredScreen from './MigrationRequiredScreen';

function Splash({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-surface-100 via-surface-50 to-primary-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <BrandLogo className="w-20 h-20 rounded-3xl bg-white shadow-glow ring-1 ring-black/5 p-2.5" />
      <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
        <Loader2 size={15} className="animate-spin" />
        {label}
      </div>
    </div>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, initializing, pinState, migrationRequired, error } = useAuth();

  if (initializing || status === 'loading') {
    return <Splash label="Restoring your session…" />;
  }

  if (status === 'signedOut') {
    // The error explains a profile that could not be resolved, so it is shown
    // instead of silently returning the user to a bare login form.
    return <LoginScreen initialError={error} />;
  }

  if (migrationRequired) {
    return <MigrationRequiredScreen />;
  }

  if (pinState === 'needsSetup') {
    return <PinSetupScreen />;
  }

  if (pinState === 'locked') {
    return <PinGateScreen />;
  }

  if (pinState === 'unlocked') {
    return <>{children}</>;
  }

  // status === 'signedIn' but the profile could not be resolved.
  return <Splash label="Loading your profile…" />;
}