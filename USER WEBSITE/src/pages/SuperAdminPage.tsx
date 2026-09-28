// ============================================
// Super Admin Panel (/4321)
// Protected by password '654321' on EVERY page load/refresh
// Teacher creation shifted here per user request
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Sliders,
  Database,
  Trash2,
  Activity,
  KeyRound,
  Download,
  ExternalLink,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, Input, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { insforge } from '../lib/insforge';
import { dbService } from '../services/db';
import { isAdminCodeValid } from '../lib/secrets';
import { downloadJson } from '../lib/utils';
import type { Batch, Student, Holiday, Fine, Teacher, Settings, ActivityLog } from '../types/database';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const { refreshTeachers } = useTeacher();
  const { profile: currentProfile } = useAuth();

  // Authentication State: PURE IN-MEMORY (no session persistence, no remember me)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<
    'teachers' | 'settings' | 'recycle' | 'database' | 'logs'
  >('teachers');

  // Teachers State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // Global Settings State
  const [globalSettings, setGlobalSettings] = useState<Partial<Settings>>({
    min_attendance_percent: 70,
    fine_amount: 500,
    max_allowed_leaves: 4,
    app_primary_color: '#6366f1',
    app_secondary_color: '#10b981',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // (Feature toggles were removed: they were never read by any code, so they
  // only pretended to control something.)

  // Global Recycle Bin State
  const [globalDeleted, setGlobalDeleted] = useState<{
    batches: Batch[];
    students: Student[];
    holidays: Holiday[];
    fines: Fine[];
  }>({ batches: [], students: [], holidays: [], fines: [] });

  // DB Stats & Logs
  const [dbStats, setDbStats] = useState({
    teachersCount: 0,
    batchesCount: 0,
    studentsCount: 0,
    attendanceCount: 0,
    finesCount: 0,
    connectionStatus: 'Checking...',
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Password verification.
  // The code is compared against the obfuscated constant (lib/secrets.ts)
  // rather than a plain-text literal, using a constant-time comparison.
  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminCodeValid(passwordInput)) {
      setIsAuthenticated(true);
      setAuthError(false);
      setPasswordInput('');
      showToast('Super Admin access granted', 'success');
      loadAllAdminData();
    } else {
      setAuthError(true);
      showToast('Invalid password! Redirecting to home...', 'error');
      setTimeout(() => {
        navigate('/');
      }, 1200);
    }
  };

  // Load all platform data
  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      // 1. Teachers
      const { data: tData } = await insforge.database
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false });
      if (tData) setTeachers(tData as Teacher[]);

      // 2. Global settings
      const { data: sData } = await insforge.database
        .from('settings')
        .select('*')
        .is('teacher_id', null);
      if (sData && sData.length > 0) {
        setGlobalSettings(sData[0] as Settings);
      }

      // 3. DB counts
      const [bRes, stRes, aRes, fRes] = await Promise.all([
        insforge.database.from('batches').select('id'),
        insforge.database.from('students').select('id'),
        insforge.database.from('attendance').select('id'),
        insforge.database.from('fines').select('id'),
      ]);

      setDbStats({
        teachersCount: tData?.length || 0,
        batchesCount: bRes.data?.length || 0,
        studentsCount: stRes.data?.length || 0,
        attendanceCount: aRes.data?.length || 0,
        finesCount: fRes.data?.length || 0,
        connectionStatus: 'Connected (InsForge PostgreSQL)',
      });

      // 4. Global recycle bin (all four record types, not just students)
      const recycle = await dbService.getAllRecycleBinItems();
      setGlobalDeleted(recycle);

      // 5. Activity logs
      const logs = await dbService.getActivityLogs(40);
      setActivityLogs(logs);
    } catch (err) {
      console.warn('Admin load error:', err);
      setDbStats((prev) => ({ ...prev, connectionStatus: 'Connection Issue' }));
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Create Teacher Action (shifted here per user instructions!)
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) {
      showToast('Please enter a teacher name', 'error');
      return;
    }

    setCreatingTeacher(true);
    try {
      // Explicitly unlinked: user_id stays null so this placeholder cannot be
      // mistaken for an account-backed profile.
      const { error } = await insforge.database
        .from('teachers')
        .insert([
          {
            name: newTeacherName.trim(),
            theme_preference: 'system',
            user_id: null,
            is_admin: false,
          },
        ])
        .select();

      if (error) throw error;

      showToast(`Teacher profile "${newTeacherName.trim()}" added.`, 'success');
      setNewTeacherName('');
      await loadAllAdminData();
      await refreshTeachers();

      dbService.logActivity('Super Admin', 'Created Teacher Profile', {
        teacher_name: newTeacherName.trim(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create error';
      showToast(msg, 'error');
    } finally {
      setCreatingTeacher(false);
    }
  };

  // Teacher records are now bound to real accounts, so "switching" into another
// teacher's panel is no longer possible from the client: every query is scoped
// to the signed-in account by the database. This is intentional - impersonation
// would be a security hole. To inspect another teacher, sign in as them.
  const handleImpersonate = (teacher: Teacher) => {
    showToast(
      `Viewing "${teacher.name}" is not possible from here. Each teacher's data is scoped to their own account.`,
      'info'
    );
  };

  // Save Global Settings
  const handleSaveGlobalSettings = async () => {
    setSavingSettings(true);
    try {
      const { data: existing } = await insforge.database
        .from('settings')
        .select('id')
        .is('teacher_id', null);

      if (existing && existing.length > 0) {
        await insforge.database
          .from('settings')
          .update({
            min_attendance_percent: Number(globalSettings.min_attendance_percent),
            fine_amount: Number(globalSettings.fine_amount),
            max_allowed_leaves: Number(globalSettings.max_allowed_leaves),
            app_primary_color: globalSettings.app_primary_color,
            app_secondary_color: globalSettings.app_secondary_color,
          })
          .eq('id', (existing[0] as any).id);
      } else {
        await insforge.database.from('settings').insert([
          {
            teacher_id: null,
            min_attendance_percent: Number(globalSettings.min_attendance_percent),
            fine_amount: Number(globalSettings.fine_amount),
            max_allowed_leaves: Number(globalSettings.max_allowed_leaves),
            app_primary_color: globalSettings.app_primary_color,
            app_secondary_color: globalSettings.app_secondary_color,
          },
        ]);
      }

      showToast('Global settings override saved!', 'success');
      dbService.logActivity('Super Admin', 'Overrode Global Settings', globalSettings as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      showToast(msg, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Purge 30-day Recycle Bin
  const handlePurgeRecycleBin = async () => {
    const ok = window.confirm('Purge all recycle bin records older than 30 days?');
    if (!ok) return;

    try {
      const res = await dbService.autoPurgeRecycleBinOlderThan30Days();
      showToast(`Purged ${res.purgedCount} expired records`, 'success');
      await loadAllAdminData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purge error';
      showToast(msg, 'error');
    }
  };

  // Export Full Platform Backup (JSON)
  const handleDownloadBackup = async () => {
    try {
      const [tRes, bRes, sRes, aRes, fRes, hRes] = await Promise.all([
        insforge.database.from('teachers').select('*'),
        insforge.database.from('batches').select('*'),
        insforge.database.from('students').select('*'),
        insforge.database.from('attendance').select('*'),
        insforge.database.from('fines').select('*'),
        insforge.database.from('holidays').select('*'),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        teachers: tRes.data || [],
        batches: bRes.data || [],
        students: sRes.data || [],
        attendance: aRes.data || [],
        fines: fRes.data || [],
        holidays: hRes.data || [],
      };

      // Shared helper revokes the object URL afterwards instead of leaking it.
      downloadJson(
        `TuitionPanel_Backup_${new Date().toISOString().split('T')[0]}.json`,
        backup
      );
      showToast('Full database backup downloaded!', 'success');
    } catch {
      showToast('Backup error', 'error');
    }
  };

  // -------------------------------------------------------------
  // PASSWORD GATE: REQUIRED ON EVERY PAGE LOAD/REFRESH
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-surface-800 rounded-3xl p-8 max-w-sm w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-rose-500 to-amber-600 text-white flex items-center justify-center text-2xl shadow-glow mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">
            {t('admin.title')}
          </h2>
          <p className="text-xs text-surface-400 mt-1 mb-6">
            Security authentication required on every visit. Enter administrator password:
          </p>

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <input
              type="password"
              autoFocus
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setAuthError(false);
              }}
              className="w-full px-4 py-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 text-center font-mono tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            {authError && (
              <p className="text-xs text-rose-500 font-semibold animate-pulse">
                Incorrect Password! Redirecting...
              </p>
            )}

            <Button
              type="submit"
              variant="danger"
              className="w-full py-3 text-sm font-bold shadow-md"
            >
              Verify & Enter Panel
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED SUPER ADMIN VIEW
  // -------------------------------------------------------------
  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-glow">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="page-title text-rose-600 dark:text-rose-400">
              {t('admin.title')}
            </h1>
            <p className="page-subtitle">Platform-wide control, teacher provisioning, and security</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleDownloadBackup}
          >
            Export Backup
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAuthenticated(false);
              setPasswordInput('');
            }}
          >
            Lock Session
          </Button>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex bg-surface-100 dark:bg-surface-800 p-1.5 rounded-2xl border border-surface-200 dark:border-surface-700 overflow-x-auto">
        <button
          type="button"
          onClick={() => setAdminTab('teachers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            adminTab === 'teachers'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          👨‍🏫 Teachers Provisioning ({teachers.length})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            adminTab === 'settings'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          ⚙️ Global Overrides & Toggles
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('database')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            adminTab === 'database'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          🗄️ Database Stats
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('recycle')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            adminTab === 'recycle'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          🗑️ Global Recycle Bin
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            adminTab === 'logs'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
              : 'text-surface-500 hover:text-surface-900'
          }`}
        >
          📜 Activity & Audit Logs
        </button>
      </div>

      {loadingData ? (
        <div className="flex justify-center py-20">
          <Spinner size={36} />
        </div>
      ) : (
        <>
          {/* TAB 1: TEACHER PROVISIONING & MONITORING */}
          {adminTab === 'teachers' && (
            <div className="space-y-6">
              {/* Create Teacher Profile */}
              <Card className="border-l-4 border-l-primary-500">
                <div className="flex items-center gap-2.5 mb-3">
                  <UserPlus size={18} className="text-primary-500" />
                  <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                    Add a Teacher Profile
                  </h3>
                </div>
                <form onSubmit={handleCreateTeacher} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Teacher Full Name (e.g. Sir Naveed, Miss Maryam)"
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={creatingTeacher}
                    className="sm:w-auto"
                  >
                    Add Profile
                  </Button>
                </form>
                <p className="text-[11px] text-surface-400 mt-3 leading-relaxed">
                  Teachers normally create their own account from the sign-up screen, which also
                  creates their profile automatically. A profile added here is a placeholder with
                  no login until an account is linked to it.
                </p>
              </Card>

              {/* Teachers List */}
              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                  <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                    Registered Teacher Profiles ({teachers.length})
                  </h3>
                  <p className="text-xs text-surface-400">
                    Each profile belongs to exactly one signed-in account. Teachers manage their
                    own batches and settings.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                      <tr>
                        <th className="px-6 py-3.5">Teacher Name</th>
                        <th className="px-6 py-3.5">Account</th>
                        <th className="px-6 py-3.5">Access</th>
                        <th className="px-6 py-3.5">Created</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-surface-50/50">
                          <td className="px-6 py-3.5 font-bold text-surface-900 dark:text-white">
                            {teacher.name}
                            {currentProfile?.id === teacher.id && (
                              <span className="ml-2 badge-success text-[9px]">You</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-xs font-mono">
                            {teacher.user_id ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                linked
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">
                                no account
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-xs">
                            {teacher.is_admin ? (
                              <span className="badge-warning text-[9px]">Admin</span>
                            ) : (
                              <span className="text-surface-400">Teacher</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-surface-500 font-mono">
                            {new Date(teacher.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleImpersonate(teacher)}
                              className="btn-secondary py-1 px-3 text-xs inline-flex items-center gap-1.5"
                            >
                              <ExternalLink size={12} /> Info
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: GLOBAL SETTINGS OVERRIDES & FEATURE TOGGLES */}
          {adminTab === 'settings' && (
            <div className="space-y-6">
              <Card className="space-y-6">
                <div>
                  <h3 className="font-bold text-base text-surface-900 dark:text-white mb-1">
                    System-Wide Global Defaults
                  </h3>
                  <p className="text-xs text-surface-400">
                    These rules apply as global defaults for any new teacher without customized settings.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Default Min Attendance (%)"
                    type="number"
                    value={globalSettings.min_attendance_percent}
                    onChange={(e) =>
                      setGlobalSettings((p) => ({ ...p, min_attendance_percent: Number(e.target.value) }))
                    }
                  />
                  <Input
                    label="Default Fine Amount (PKR)"
                    type="number"
                    value={globalSettings.fine_amount}
                    onChange={(e) =>
                      setGlobalSettings((p) => ({ ...p, fine_amount: Number(e.target.value) }))
                    }
                  />
                  <Input
                    label="Default Max Leaves"
                    type="number"
                    value={globalSettings.max_allowed_leaves}
                    onChange={(e) =>
                      setGlobalSettings((p) => ({ ...p, max_allowed_leaves: Number(e.target.value) }))
                    }
                  />
                </div>

                {/* Feature status - informational only */}
                <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="font-semibold text-sm text-surface-800 dark:text-white mb-1">
                    Feature Status
                  </h4>
                  <p className="text-[11px] text-surface-400 mb-3 leading-relaxed">
                    These describe the app as it is built. They are not switches: nothing read the
                    old toggles, so ticking them had no effect. Change a feature in code, not here.
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700">
                      <span className="text-surface-700 dark:text-surface-300">
                        AI Register Scanner
                      </span>
                      <span className="badge-warning text-[10px]">
                        Locked &middot; Premium
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700">
                      <span className="text-surface-700 dark:text-surface-300">
                        Custom disciplinary fines
                      </span>
                      <span className="badge-success text-[10px]">Available</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700">
                      <span className="text-surface-700 dark:text-surface-300">
                        Recycle Bin (30-day soft delete)
                      </span>
                      <span className="badge-success text-[10px]">Always on</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700">
                      <span className="text-surface-700 dark:text-surface-300">
                        Account + PIN security
                      </span>
                      <span className="badge-success text-[10px]">Always on</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  loading={savingSettings}
                  onClick={handleSaveGlobalSettings}
                >
                  Save Global Defaults
                </Button>
              </Card>
            </div>
          )}

          {/* TAB 3: DATABASE STATS */}
          {adminTab === 'database' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-l-emerald-500">
                  <span className="stat-label">Connection Status</span>
                  <p className="font-bold text-emerald-600 text-sm mt-1">
                    {dbStats.connectionStatus}
                  </p>
                  <p className="text-xs text-surface-400 mt-1">PostgreSQL on InsForge.dev</p>
                </Card>

                <Card className="p-4">
                  <span className="stat-label">Total Batches</span>
                  <p className="stat-value mt-1">{dbStats.batchesCount}</p>
                  <p className="text-xs text-surface-400 mt-1">Across all teachers</p>
                </Card>

                <Card className="p-4">
                  <span className="stat-label">Total Students</span>
                  <p className="stat-value mt-1">{dbStats.studentsCount}</p>
                  <p className="text-xs text-surface-400 mt-1">Active platform students</p>
                </Card>

                <Card className="p-4">
                  <span className="stat-label">Attendance Records</span>
                  <p className="stat-value mt-1">{dbStats.attendanceCount}</p>
                  <p className="text-xs text-surface-400 mt-1">Indexed day entries</p>
                </Card>

                <Card className="p-4">
                  <span className="stat-label">Fine Records</span>
                  <p className="stat-value mt-1">{dbStats.finesCount}</p>
                  <p className="text-xs text-surface-400 mt-1">Total pending & collected</p>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4: GLOBAL RECYCLE BIN */}
          {adminTab === 'recycle' && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-200 dark:border-surface-700">
                <div>
                  <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                    Platform-Wide Deleted Records
                  </h3>
                  <p className="text-xs text-surface-400">
                    Batches ({globalDeleted.batches.length}), Students (
                    {globalDeleted.students.length}), Holidays ({globalDeleted.holidays.length}),
                    Fines ({globalDeleted.fines.length})
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={handlePurgeRecycleBin}>
                  {t('admin.purge_recycle')}
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                {globalDeleted.batches.length === 0 &&
                  globalDeleted.students.length === 0 &&
                  globalDeleted.holidays.length === 0 &&
                  globalDeleted.fines.length === 0 && (
                    <p className="text-center py-8 text-surface-400">
                      The recycle bin is empty across the platform.
                    </p>
                  )}

                {globalDeleted.batches.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-between gap-3"
                  >
                    <span className="truncate">
                      Batch: <strong>{b.name}</strong>{' '}
                      <span className="text-surface-400">
                        ({b.deleted_at ? new Date(b.deleted_at).toLocaleDateString() : 'Recently'})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void dbService.restoreBatch(b.id).then(() => loadAllAdminData());
                      }}
                      className="text-primary-600 font-semibold shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}

                {globalDeleted.students.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-between gap-3"
                  >
                    <span className="truncate">
                      Student: <strong>{s.name}</strong>{' '}
                      <span className="text-surface-400">
                        ({s.deleted_at ? new Date(s.deleted_at).toLocaleDateString() : 'Recently'})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void dbService.restoreStudent(s.id).then(() => loadAllAdminData());
                      }}
                      className="text-primary-600 font-semibold shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}

                {globalDeleted.holidays.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-between gap-3"
                  >
                    <span className="truncate">
                      Holiday: <strong>{h.label}</strong>{' '}
                      <span className="text-surface-400 font-mono">{h.date}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void dbService.restoreHoliday(h.id).then(() => loadAllAdminData());
                      }}
                      className="text-primary-600 font-semibold shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}

                {globalDeleted.fines.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 flex items-center justify-between gap-3"
                  >
                    <span className="truncate">
                      Fine: <strong>{f.label}</strong>{' '}
                      <span className="text-surface-400 font-mono">
                        PKR {Number(f.amount || 0).toLocaleString()} · {f.month}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void dbService.restoreFine(f.id).then(() => loadAllAdminData());
                      }}
                      className="text-primary-600 font-semibold shrink-0"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 5: LOGS */}
          {adminTab === 'logs' && (
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-surface-200 dark:border-surface-700">
                <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                  System Audit & Activity Logs
                </h3>
              </div>
              <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-96 overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="p-4 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-surface-800 dark:text-surface-200">
                        {log.teacher_name}
                      </span>{' '}
                      — <span className="text-primary-600 font-medium">{log.action}</span>
                      {log.details && (
                        <span className="text-surface-400 font-mono ml-2">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                    <span className="text-surface-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
