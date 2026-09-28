// ============================================
// Settings Page - Account & Rules Configuration
//
// The teacher picker has been removed: settings always belong to the
// signed-in account's own profile. A "change PIN" section was added.
// ============================================

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Percent,
  BadgeDollarSign,
  CalendarMinus,
  Palette,
  Shield,
  KeyRound,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Spinner,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSettings } from '../hooks/useSettings';
import { dbService } from '../services/db';
import PinInput from '../components/auth/PinInput';
import { PIN_LENGTH } from '../lib/crypto';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { currentTeacher } = useTeacher();
  const { changePin, email, error: authError, clearError } = useAuth();
  const { t } = useLanguage();

  // Settings always belong to the signed-in account.
  const selectedTeacherId = currentTeacher?.id ?? '';

  const { settings, loading, saving, error, saveSettings } = useSettings(
    selectedTeacherId || undefined
  );

  // Form state
  const [minAttendance, setMinAttendance] = useState('70');
  const [fineAmount, setFineAmount] = useState('500');
  const [maxLeaves, setMaxLeaves] = useState('4');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [hasChanges, setHasChanges] = useState(false);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'idle' | 'current' | 'new'>('idle');
  const [changingPin, setChangingPin] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Populate the form when settings load
  useEffect(() => {
    if (settings) {
      setMinAttendance(String(settings.min_attendance_percent ?? 70));
      setFineAmount(String(settings.fine_amount ?? 500));
      setMaxLeaves(String(settings.max_allowed_leaves ?? 4));
      setPrimaryColor(settings.app_primary_color ?? '#6366f1');
      setSecondaryColor(settings.app_secondary_color ?? '#10b981');
      setHasChanges(false);
    }
  }, [settings]);

  // Track unsaved changes
  useEffect(() => {
    if (!settings) return;
    const changed =
      Number(minAttendance) !== (settings.min_attendance_percent ?? 70) ||
      Number(fineAmount) !== (settings.fine_amount ?? 500) ||
      Number(maxLeaves) !== (settings.max_allowed_leaves ?? 4) ||
      primaryColor !== (settings.app_primary_color ?? '#6366f1') ||
      secondaryColor !== (settings.app_secondary_color ?? '#10b981');
    setHasChanges(changed);
  }, [minAttendance, fineAmount, maxLeaves, primaryColor, secondaryColor, settings]);

  const handleSave = async () => {
    const attendance = Number(minAttendance);
    const fine = Number(fineAmount);
    const leaves = Number(maxLeaves);

    if (isNaN(attendance) || attendance < 0 || attendance > 100) {
      showToast('Attendance percentage must be between 0 and 100', 'error');
      return;
    }
    if (isNaN(fine) || fine < 0) {
      showToast('Fine amount must be a positive number', 'error');
      return;
    }
    if (isNaN(leaves) || leaves < 0 || leaves > 31) {
      showToast('Maximum leaves must be between 0 and 31', 'error');
      return;
    }

    const success = await saveSettings(
      {
        min_attendance_percent: attendance,
        fine_amount: fine,
        max_allowed_leaves: leaves,
        app_primary_color: primaryColor,
        app_secondary_color: secondaryColor,
      },
      selectedTeacherId || undefined
    );

    if (success) {
      const teacherName = currentTeacher?.name || 'Teacher';
      dbService.logActivity(teacherName, 'Updated Configuration', {
        min_attendance_percent: attendance,
        fine_amount: fine,
        max_allowed_leaves: leaves,
        teacher_id: selectedTeacherId || null,
      });
      showToast(`Settings saved for ${teacherName}!`, 'success');
    } else {
      showToast('Failed to save settings. Please verify connection.', 'error');
    }
  };

  // ---- PIN change flow ----
  const resetPinFlow = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinStep('idle');
    setPinMessage(null);
    clearError();
  };

  const handleNewPinComplete = async (pin: string) => {
    if (pin !== confirmPin) {
      setPinMessage({ text: 'The two new PINs do not match. Please try again.', ok: false });
      setNewPin('');
      setConfirmPin('');
      return;
    }

    setChangingPin(true);
    setPinMessage(null);
    try {
      const ok = await changePin(currentPin, pin);
      if (ok) {
        setPinMessage({ text: 'Your PIN has been changed successfully.', ok: true });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setPinStep('idle');
      } else {
        setPinMessage({ text: authError || 'Could not change the PIN.', ok: false });
        setNewPin('');
        setConfirmPin('');
      }
    } finally {
      setChangingPin(false);
    }
  };

  const handleReset = () => {
    setMinAttendance('70');
    setFineAmount('500');
    setMaxLeaves('4');
    setPrimaryColor('#6366f1');
    setSecondaryColor('#10b981');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
              <SettingsIcon size={20} className="text-white" />
            </div>
            <h1 className="page-title">{t('settings.title')}</h1>
          </div>
          <p className="page-subtitle ml-[52px]">
            Configure attendance thresholds, fine rules, theme colors and your security PIN
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<RotateCcw size={16} />}
            onClick={handleReset}
            disabled={saving}
          >
            Reset Defaults
          </Button>
          <Button
            variant="primary"
            icon={<Save size={16} />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Account Card (the teacher picker was removed) */}
      <Card className="border-l-4 border-l-primary-500 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
              {(currentTeacher?.name || 'T').trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                {currentTeacher?.name || 'Your Account'}
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {email || 'Signed in'}
              </p>
            </div>
          </div>
          <span className="badge-success">
            <Shield size={11} /> PIN protected
          </span>
        </div>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm animate-fade-in">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Percent size={18} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle>Attendance Rules</CardTitle>
                <CardDescription>Set minimum attendance threshold</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label={t('settings.min_att')}
              type="number"
              min="0"
              max="100"
              value={minAttendance}
              onChange={(e) => setMinAttendance(e.target.value)}
              hint={`Students below this percentage are flagged as defaulters (current: ${minAttendance}%)`}
              icon={<Percent size={16} />}
              id="settings-min-attendance"
            />
            <Input
              label={t('settings.max_leaves')}
              type="number"
              min="0"
              max="31"
              value={maxLeaves}
              onChange={(e) => setMaxLeaves(e.target.value)}
              hint="Leaves per month that still count toward the attendance percentage"
              icon={<CalendarMinus size={16} />}
              id="settings-max-leaves"
            />
          </div>
        </Card>

        {/* Fine Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <BadgeDollarSign size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle>Fine Configuration</CardTitle>
                <CardDescription>Configure fine amounts in PKR</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label={t('settings.fine_amt')}
              type="number"
              min="0"
              value={fineAmount}
              onChange={(e) => setFineAmount(e.target.value)}
              hint="Amount generated by an auto-fine when attendance falls below the minimum"
              icon={<BadgeDollarSign size={16} />}
              id="settings-fine-amount"
            />
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-400">
              Auto-fines account for all registered holidays and up to {maxLeaves} allowed leaves.
              These values now drive the Fines, Reports and Dashboard calculations.
            </div>
          </div>
        </Card>

        {/* App Appearance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Palette size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Theme Colors</CardTitle>
                <CardDescription>Customize primary &amp; secondary brand accents</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="settings-primary-color" className="input-label">
                {t('settings.primary_color')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-surface-200 dark:border-surface-700 cursor-pointer"
                  id="settings-primary-color"
                />
                <div className="flex-1">
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#6366f1"
                  />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="settings-secondary-color" className="input-label">
                {t('settings.secondary_color')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-surface-200 dark:border-surface-700 cursor-pointer"
                  id="settings-secondary-color"
                />
                <div className="flex-1">
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#10b981"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Security PIN */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <KeyRound size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle>Security PIN</CardTitle>
                <CardDescription>
                  Change the {PIN_LENGTH}-digit PIN required every time the dashboard opens
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          {pinMessage && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs border ${
                pinMessage.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
              }`}
            >
              {pinMessage.text}
            </div>
          )}

          {pinStep === 'idle' ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-surface-500 dark:text-surface-400 max-w-md leading-relaxed">
                Your PIN is stored only as a secure PBKDF2 hash. Nobody can read it back out,
                including an administrator.
              </p>
              <Button
                variant="secondary"
                icon={<KeyRound size={15} />}
                onClick={() => {
                  setPinStep('current');
                  setPinMessage(null);
                  clearError();
                }}
              >
                Change PIN
              </Button>
            </div>
          ) : pinStep === 'current' ? (
            <div className="space-y-4 max-w-sm">
              <PinInput
                key="current"
                id="settings-current-pin"
                label="Enter your current PIN"
                value={currentPin}
                onChange={setCurrentPin}
                autoFocus
                disabled={changingPin}
              />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={resetPinFlow}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={currentPin.length !== PIN_LENGTH}
                  onClick={() => {
                    setPinStep('new');
                    setPinMessage(null);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-sm">
              <PinInput
                key="new"
                id="settings-new-pin"
                label={`Choose a new ${PIN_LENGTH}-digit PIN`}
                value={newPin}
                onChange={setNewPin}
                autoFocus
                disabled={changingPin}
              />
              <PinInput
                key="confirm-new"
                id="settings-confirm-pin"
                label="Re-enter the new PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                onComplete={handleNewPinComplete}
                disabled={changingPin || newPin.length !== PIN_LENGTH}
              />
              {changingPin && <p className="text-xs text-surface-400">Saving your new PIN…</p>}
              <Button
                variant="secondary"
                className="w-full"
                onClick={resetPinFlow}
                disabled={changingPin}
              >
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Summary Card */}
      <div className="p-4 glass-card flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap text-xs">
          <div>
            <span className="stat-label">Min Attendance</span>
            <p className="text-base font-bold text-surface-900 dark:text-white">{minAttendance}%</p>
          </div>
          <div className="w-px h-8 bg-surface-200 dark:bg-surface-700 hidden sm:block" />
          <div>
            <span className="stat-label">Fine Amount</span>
            <p className="text-base font-bold text-surface-900 dark:text-white">
              PKR {Number(fineAmount).toLocaleString()}
            </p>
          </div>
          <div className="w-px h-8 bg-surface-200 dark:bg-surface-700 hidden sm:block" />
          <div>
            <span className="stat-label">Max Leaves</span>
            <p className="text-base font-bold text-surface-900 dark:text-white">
              {maxLeaves}/month
            </p>
          </div>
        </div>

        {hasChanges && <span className="badge-warning animate-pulse-soft">Unsaved changes</span>}
      </div>
    </div>
  );
}