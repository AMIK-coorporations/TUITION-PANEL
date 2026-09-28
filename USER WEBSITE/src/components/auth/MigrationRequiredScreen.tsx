// ============================================
// MigrationRequiredScreen
// Shown when the database is missing the columns this app needs.
// ============================================

import { Database, LogOut, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';

export default function MigrationRequiredScreen() {
  const { signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const path = 'USER WEBSITE/migrations/001_accounts_pin_and_rls.sql';

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the path is shown on screen anyway.
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-100 via-surface-50 to-amber-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="w-full max-w-lg glass-card p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-glow mb-4">
            <Database size={28} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">
            Database Setup Required
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-2 leading-relaxed">
            Your account works, but the database is missing the columns this app needs for
            accounts and the 6-digit PIN.
          </p>
        </div>

        <div className="rounded-2xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 p-4 space-y-3">
          <p className="text-xs font-semibold text-surface-700 dark:text-surface-200">
            To finish setup:
          </p>
          <ol className="text-xs text-surface-600 dark:text-surface-400 space-y-2 list-decimal list-inside leading-relaxed">
            <li>Open your InsForge project dashboard.</li>
            <li>Open the SQL editor.</li>
            <li>
              Run the migration file{' '}
              <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-primary-700 dark:text-primary-300">
                {path}
              </code>
            </li>
            <li>Reload this page.</li>
          </ol>
          <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed">
            Run <strong>PART 1</strong> and <strong>PART 2</strong> first. <strong>PART 3</strong>{' '}
            (row level security) changes who can read what — read its warning before running it.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" className="flex-1" onClick={() => void copyPath()}>
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy path'}
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-xs text-surface-400 hover:text-rose-500 flex items-center justify-center gap-1.5 mt-5"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </div>
  );
}