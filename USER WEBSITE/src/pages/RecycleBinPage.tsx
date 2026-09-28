// ============================================
// Recycle Bin Page (Teacher View)
// 30-Day retention, Restore, Permanent delete, and Auto-purge
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Clock,
  AlertTriangle,
  User,
  CalendarOff,
  Receipt,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { Card, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService } from '../services/db';
import type { Batch, Student, Holiday, Fine } from '../types/database';

export default function RecycleBinPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'holidays' | 'fines'>(
    'batches'
  );
  const [loading, setLoading] = useState(true);
  // Batches were never shown here, so a deleted batch (and every student in it)
  // was invisible and could not be restored.
  const [deletedBatches, setDeletedBatches] = useState<Batch[]>([]);
  const [deletedStudents, setDeletedStudents] = useState<Student[]>([]);
  const [deletedHolidays, setDeletedHolidays] = useState<Holiday[]>([]);
  const [deletedFines, setDeletedFines] = useState<Fine[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadRecycleBin = useCallback(async () => {
    if (!currentTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Run auto purge for >30 days records silently
      await dbService.autoPurgeRecycleBinOlderThan30Days();

      const items = await dbService.getRecycleBinItems(currentTeacher.id);
      setDeletedBatches(items.batches);
      setDeletedStudents(items.students);
      setDeletedHolidays(items.holidays);
      setDeletedFines(items.fines);
    } catch (err) {
      console.warn('Recycle bin load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher]);

  useEffect(() => {
    loadRecycleBin();
  }, [loadRecycleBin]);

  // Calculate days remaining from deleted_at (30 days retention)
  const getDaysRemaining = (deletedAt: string | null) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt).getTime();
    const elapsedDays = Math.floor((Date.now() - deletedDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - elapsedDays);
  };

  // Restore Action
  const handleRestore = async (
    type: 'batch' | 'student' | 'holiday' | 'fine',
    id: string,
    name: string
  ) => {
    setActionLoadingId(id);
    try {
      if (type === 'batch') await dbService.restoreBatch(id);
      else if (type === 'student') await dbService.restoreStudent(id);
      else if (type === 'holiday') await dbService.restoreHoliday(id);
      else if (type === 'fine') await dbService.restoreFine(id);

      showToast(`Restored "${name}" successfully!`, 'success');
      await loadRecycleBin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      showToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanent Delete Action
  const handlePermanentDelete = async (
    type: 'batch' | 'student' | 'holiday' | 'fine',
    id: string,
    name: string
  ) => {
    const warning =
      type === 'batch'
        ? `Permanently delete batch "${name}"? Its students and all attendance history will also be deleted. This CANNOT be undone.`
        : `Permanently delete "${name}"? This CANNOT be undone.`;
    const ok = window.confirm(warning);
    if (!ok) return;

    setActionLoadingId(id);
    try {
      if (type === 'batch') await dbService.permanentDeleteBatch(id);
      else if (type === 'student') await dbService.permanentDeleteStudent(id);
      else if (type === 'holiday') await dbService.permanentDeleteHoliday(id);
      else if (type === 'fine') await dbService.permanentDeleteFine(id);

      showToast(`Permanently deleted "${name}"`, 'info');
      await loadRecycleBin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      showToast(msg, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-glow">
            <Trash2 size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('nav.recycle_bin')}</h1>
            <p className="page-subtitle">30-day retention window for restored or purged records</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap bg-surface-100 dark:bg-surface-800 p-1 rounded-2xl border border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'batches'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            📚 Batches ({deletedBatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'students'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            👨‍🎓 Students ({deletedStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('holidays')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'holidays'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            🏖️ Holidays ({deletedHolidays.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fines')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'fines'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            💰 Fines ({deletedFines.length})
          </button>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <Clock size={16} className="shrink-0" />
        <span>
          Items remain in the Recycle Bin for <strong>30 days</strong>. After 30 days, they are permanently purged automatically.
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Batches list */}
          {activeTab === 'batches' && (
            <div>
              {deletedBatches.length === 0 ? (
                <div className="text-center py-16 text-surface-400 text-xs">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  Recycle bin is clean. No deleted batches.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                      <tr>
                        <th className="px-6 py-3.5">Batch Name</th>
                        <th className="px-6 py-3.5">Deleted At</th>
                        <th className="px-6 py-3.5">Retention Left</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                      {deletedBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-surface-50/50">
                          <td className="px-6 py-3.5 font-medium flex items-center gap-2">
                            <BookOpen size={14} className="text-primary-500 shrink-0" />
                            {b.name}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-surface-400 font-mono">
                            {b.deleted_at
                              ? new Date(b.deleted_at).toLocaleString()
                              : 'Recently'}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                              {getDaysRemaining(b.deleted_at)} days left
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRestore('batch', b.id, b.name)}
                              disabled={actionLoadingId === b.id}
                              className="btn-secondary py-1 px-2 text-xs inline-flex items-center gap-1"
                            >
                              <RotateCcw size={12} /> {t('common.restore')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePermanentDelete('batch', b.id, b.name)}
                              disabled={actionLoadingId === b.id}
                              className="btn-danger py-1 px-2 text-xs inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-6 py-3 text-[11px] text-surface-400 border-t border-surface-100 dark:border-surface-800">
                    Restoring a batch also restores the students, attendance and fines that were
                    archived with it.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Students list */}
          {activeTab === 'students' && (
            <div>
              {deletedStudents.length === 0 ? (
                <div className="text-center py-16 text-surface-400 text-xs">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  Recycle bin is clean. No deleted students.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                    <tr>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-6 py-3.5">Deleted At</th>
                      <th className="px-6 py-3.5">Retention Left</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {deletedStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-surface-50/50">
                        <td className="px-6 py-3.5 font-medium">{st.name}</td>
                        <td className="px-6 py-3.5 text-xs text-surface-400 font-mono">
                          {st.deleted_at ? new Date(st.deleted_at).toLocaleString() : 'Recently'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                            {getDaysRemaining(st.deleted_at)} days left
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRestore('student', st.id, st.name)}
                            disabled={actionLoadingId === st.id}
                            className="btn-secondary py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> {t('common.restore')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete('student', st.id, st.name)}
                            disabled={actionLoadingId === st.id}
                            className="btn-danger py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Holidays list */}
          {activeTab === 'holidays' && (
            <div>
              {deletedHolidays.length === 0 ? (
                <div className="text-center py-16 text-surface-400 text-xs">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  No deleted holidays in recycle bin.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                    <tr>
                      <th className="px-6 py-3.5">Holiday Date & Label</th>
                      <th className="px-6 py-3.5">Deleted At</th>
                      <th className="px-6 py-3.5">Retention Left</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {deletedHolidays.map((h) => (
                      <tr key={h.id} className="hover:bg-surface-50/50">
                        <td className="px-6 py-3.5 font-medium">
                          {h.label} ({h.date})
                        </td>
                        <td className="px-6 py-3.5 text-xs text-surface-400 font-mono">
                          {h.deleted_at ? new Date(h.deleted_at).toLocaleString() : 'Recently'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                            {getDaysRemaining(h.deleted_at)} days left
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRestore('holiday', h.id, h.label)}
                            disabled={actionLoadingId === h.id}
                            className="btn-secondary py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> {t('common.restore')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete('holiday', h.id, h.label)}
                            disabled={actionLoadingId === h.id}
                            className="btn-danger py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Fines list */}
          {activeTab === 'fines' && (
            <div>
              {deletedFines.length === 0 ? (
                <div className="text-center py-16 text-surface-400 text-xs">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  No deleted fines in recycle bin.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-50 dark:bg-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                    <tr>
                      <th className="px-6 py-3.5">Fine Label & Month</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Retention Left</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {deletedFines.map((f) => (
                      <tr key={f.id} className="hover:bg-surface-50/50">
                        <td className="px-6 py-3.5 font-medium">
                          {f.label} ({f.month})
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold">
                          PKR {f.amount}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="badge bg-amber-100 text-amber-800 text-[10px]">
                            {getDaysRemaining(f.deleted_at)} days left
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleRestore('fine', f.id, f.label)}
                            disabled={actionLoadingId === f.id}
                            className="btn-secondary py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> {t('common.restore')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete('fine', f.id, f.label)}
                            disabled={actionLoadingId === f.id}
                            className="btn-danger py-1 px-2 text-xs inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
