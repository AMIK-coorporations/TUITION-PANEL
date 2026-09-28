// ============================================
// Attendance Module - AI Scanner & Manual Bulk Entry
// Optimized for end-of-month bulk entry (not daily)
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarDays,
  Camera,
  Edit3,
  CheckCircle,
  Save,
  AlertTriangle,
  Upload,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService, DEFAULT_RULES, type AttendanceRules } from '../services/db';
import { daysInMonth as daysInMonthForKey, isValidMonthKey } from '../lib/utils';
import type { Batch, Student, Holiday, Attendance } from '../types/database';

type StatusType = 'P' | 'A' | 'L' | '';

interface StudentRow {
  studentId: string;
  name: string;
  isNew?: boolean;
  days: Record<number, StatusType>;
}

export default function AttendancePage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Tabs: 'manual' | 'ai-scanner' | 'summary'
  const [activeTab, setActiveTab] = useState<'manual' | 'ai-scanner' | 'summary'>('manual');

  // Month & Batch Selection
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [students, setStudents] = useState<(Student & { batch_name?: string })[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Real rules from Settings, so the summary matches what is configured.
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_RULES);

  // Matrix State: studentId -> dayNumber -> 'P' | 'A' | 'L' | ''
  const [gridData, setGridData] = useState<Record<string, Record<number, StatusType>>>({});

  // What was last loaded from / saved to the database. Compared against
  // gridData on save so that cleared cells can be deleted (see handleSave).
  const loadedSnapshotRef = useRef<Record<string, Record<number, StatusType>>>({});

  // AI Scanner state was removed with the fake generator; the locked tab is
  // static, so no scanning/review state is needed.

  // Calculate days in selected month.
  // An empty or malformed picker used to produce NaN, which then propagated
  // into the grid (no days rendered) and into the percentage maths.
  const daysInMonth = useMemo(() => {
    return isValidMonthKey(selectedMonth) ? daysInMonthForKey(selectedMonth) : 0;
  }, [selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // Load batches, students & existing attendance
  const loadData = useCallback(async () => {
    if (!currentTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [bList, sList, hList, loadedRules] = await Promise.all([
        dbService.getBatches(currentTeacher.id),
        dbService.getStudents(currentTeacher.id),
        dbService.getHolidays(currentTeacher.id),
        dbService.getRules(currentTeacher.id),
      ]);

      setBatches(bList);
      setStudents(sList);
      setHolidays(hList);
      setRules(loadedRules);

      const activeBatch = selectedBatchId || (bList.length > 0 ? bList[0].id : '');
      if (!selectedBatchId && bList.length > 0) {
        setSelectedBatchId(bList[0].id);
      }

      // Filter students of selected batch
      const batchStudents = sList.filter((s) => s.batch_id === activeBatch);
      const studentIds = batchStudents.map((s) => s.id);

      // Load existing attendance
      if (studentIds.length > 0) {
        const records = await dbService.getMonthlyAttendance(selectedMonth, studentIds);
        const matrix: Record<string, Record<number, StatusType>> = {};

        // Initialize empty for all batch students
        batchStudents.forEach((st) => {
          matrix[st.id] = {};
          for (let d = 1; d <= daysInMonth; d++) {
            matrix[st.id][d] = '';
          }
        });

        // Fill recorded statuses
        records.forEach((rec) => {
          if (matrix[rec.student_id]) {
            matrix[rec.student_id][rec.day_number] = rec.status;
          }
        });

        setGridData(matrix);
        loadedSnapshotRef.current = matrix;
      } else {
        setGridData({});
        loadedSnapshotRef.current = {};
      }
    } catch (err) {
      console.warn('Attendance load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher, selectedBatchId, selectedMonth, daysInMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Batch students list
  const currentBatchStudents = useMemo(() => {
    return students.filter((s) => s.batch_id === selectedBatchId);
  }, [students, selectedBatchId]);

  // Holiday day numbers in current month
  const holidayDayNumbers = useMemo(() => {
    return new Set(
      holidays
        .filter((h) => h.date.startsWith(selectedMonth))
        .map((h) => parseInt(h.date.split('-')[2], 10))
    );
  }, [holidays, selectedMonth]);

  // Toggle cell status: '' -> 'P' -> 'A' -> 'L' -> ''
  const handleToggleCell = (studentId: string, day: number) => {
    if (holidayDayNumbers.has(day)) return; // Can't mark on holidays

    setGridData((prev) => {
      const studentDays = { ...(prev[studentId] || {}) };
      const current = studentDays[day] || '';
      let next: StatusType = '';
      if (current === '') next = 'P';
      else if (current === 'P') next = 'A';
      else if (current === 'A') next = 'L';
      else next = '';

      return {
        ...prev,
        [studentId]: {
          ...studentDays,
          [day]: next,
        },
      };
    });
  };

  // Keyboard shortcut handler
  const handleKeyShortcut = (studentId: string, day: number, key: string) => {
    if (holidayDayNumbers.has(day)) return;
    const upper = key.toUpperCase();
    if (upper === 'P' || upper === 'A' || upper === 'L') {
      setGridData((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [day]: upper as StatusType,
        },
      }));
    }
  };

  // Quick fill all unmarked days with 'P' for a student
  const handleFillPresent = (studentId: string) => {
    setGridData((prev) => {
      const studentDays = { ...(prev[studentId] || {}) };
      for (let d = 1; d <= daysInMonth; d++) {
        if (!holidayDayNumbers.has(d) && !studentDays[d]) {
          studentDays[d] = 'P';
        }
      }
      return {
        ...prev,
        [studentId]: studentDays,
      };
    });
  };

  // Save Manual Attendance
  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const recordsToSave: {
        student_id: string;
        month: string;
        day_number: number;
        status: StatusType;
      }[] = [];

      // Snapshot of what was on screen when the month was loaded. A cell that
      // was marked then and is empty now must be sent as '' so the row is
      // DELETED. Previously cleared cells were skipped entirely, so unmarking a
      // day looked saved but silently came back after a reload.
      const snapshot = loadedSnapshotRef.current;

      Object.entries(gridData).forEach(([studentId, days]) => {
        Object.entries(days).forEach(([dayStr, status]) => {
          const dayNum = Number(dayStr);
          const hadMark = Boolean(snapshot[studentId]?.[dayNum]);
          const hasMark = status === 'P' || status === 'A' || status === 'L';

          if (hasMark) {
            recordsToSave.push({
              student_id: studentId,
              month: selectedMonth,
              day_number: dayNum,
              status,
            });
          } else if (hadMark) {
            // Explicitly cleared - include it so the service deletes the row.
            recordsToSave.push({
              student_id: studentId,
              month: selectedMonth,
              day_number: dayNum,
              status: '',
            });
          }
        });
      });

      await dbService.saveBulkAttendance(recordsToSave);

      // The screen now matches the database; refresh the snapshot.
      loadedSnapshotRef.current = gridData;

      const markedCount = recordsToSave.filter((r) => r.status !== '').length;
      if (recordsToSave.length === 0) {
        showToast('Nothing to save yet.', 'info');
      } else {
        showToast(t('att.batch_saved'), 'success');
      }

      // Log activity
      if (currentTeacher) {
        dbService.logActivity(currentTeacher.name, 'Marked Attendance', {
          batch_id: selectedBatchId,
          month: selectedMonth,
          records_count: markedCount,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------------
  // AI REGISTER SCANNER - REMOVED / LOCKED
  // ----------------------------------------------------------------
  // The previous implementation did not call any AI service. It generated
  // random Present/Absent/Leave values with Math.random() and offered to save
  // them to the database, which would have written fabricated attendance.
  // The tab is now a static "Premium - Coming Soon" panel and the generator,
  // review table, and save handler are deleted entirely so there is no code
  // path that can invent records.

  // ----------------------------------------------------------------
  // SUMMARY CALCULATIONS
  // ----------------------------------------------------------------
  const holidayDatesList = useMemo(() => holidays.map((h) => h.date), [holidays]);

  const summaryList = useMemo(() => {
    return currentBatchStudents.map((st) => {
      const studentDays = gridData[st.id] || {};
      const records: Attendance[] = Object.entries(studentDays)
        .filter(([, s]) => s === 'P' || s === 'A' || s === 'L')
        .map(([d, s]) => ({
          id: `${st.id}-${d}`,
          student_id: st.id,
          month: selectedMonth,
          day_number: Number(d),
          status: s as 'P' | 'A' | 'L',
          marked_at: '',
          is_deleted: false,
          deleted_at: null,
        }));

      const calc = dbService.calculateStudentAttendance(
        records,
        daysInMonth,
        holidayDatesList,
        selectedMonth,
        rules.maxAllowedLeaves,
        rules.minAttendancePercent
      );

      return {
        student: st,
        ...calc,
      };
    });
  }, [
    currentBatchStudents,
    gridData,
    daysInMonth,
    holidayDatesList,
    selectedMonth,
    rules,
  ]);

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-glow">
            <CalendarDays size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('att.title')}</h1>
            <p className="page-subtitle">{t('att.subtitle')}</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-2xl border border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            ✏️ {t('att.manual_entry')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai-scanner')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'ai-scanner'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            <Sparkles size={13} className="text-amber-500" />
            {t('att.ai_scanner')}
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wide">
              {t('att.premium')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'summary'
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-900'
            }`}
          >
            📊 {t('att.monthly_summary')}
          </button>
        </div>
      </div>

      {/* Control Bar: Month & Batch Selection */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center">
          <div>
            <label className="input-label text-xs mb-1">{t('common.month')}</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input py-2 text-sm"
            />
          </div>

          <div>
            <label className="input-label text-xs mb-1">{t('common.batch')}</label>
            <select
              className="select py-2 text-sm"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-end h-full pt-4 sm:pt-0">
            {activeTab === 'manual' && (
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={15} />}
                loading={saving}
                onClick={handleSaveAttendance}
                disabled={currentBatchStudents.length === 0}
                className="w-full sm:w-auto"
              >
                {t('common.save')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* TAB 1: MANUAL BULK ENTRY MATRIX */}
      {/* -------------------------------------------------------------- */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          {/* Key Legend & Working Days stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-surface-500 bg-surface-50 dark:bg-surface-800/40 p-3 rounded-2xl border border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-surface-700 dark:text-surface-300">Click or Keyboard:</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">P</kbd>
                {t('att.present')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">A</kbd>
                {t('att.absent')}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">L</kbd>
                {t('att.leave')}
              </span>
              <span className="flex items-center gap-1 text-surface-400">
                <span className="w-3 h-3 rounded bg-surface-200 dark:bg-surface-700 inline-block" />
                Holiday (Off)
              </span>
            </div>
            <div className="font-medium text-primary-600 dark:text-primary-400">
              🗓️ {daysInMonth - holidayDayNumbers.size} Working Days in {selectedMonth}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={32} />
            </div>
          ) : currentBatchStudents.length === 0 ? (
            <Card className="text-center py-16">
              <AlertTriangle size={40} className="mx-auto text-amber-500 mb-2" />
              <h3 className="font-bold text-surface-700 dark:text-surface-300">
                No students in this batch
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                Add students to this batch from the Students page to start marking attendance.
              </p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-center border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 font-bold text-surface-700 dark:text-surface-300">
                    <tr>
                      <th className="sticky left-0 z-20 bg-surface-100 dark:bg-surface-800 text-left px-4 py-3 min-w-[160px] border-r border-surface-200 dark:border-surface-700">
                        {t('common.name')}
                      </th>
                      {daysArray.map((day) => {
                        const isHoliday = holidayDayNumbers.has(day);
                        return (
                          <th
                            key={day}
                            className={`px-1.5 py-3 min-w-[32px] ${
                              isHoliday
                                ? 'bg-surface-200/70 dark:bg-surface-900 text-surface-400'
                                : ''
                            }`}
                          >
                            {day}
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 min-w-[70px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {currentBatchStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-surface-50/40 dark:hover:bg-surface-800/30">
                        <td className="sticky left-0 z-10 bg-white dark:bg-surface-900 text-left px-4 py-2 font-medium text-surface-900 dark:text-white border-r border-surface-200 dark:border-surface-700 whitespace-nowrap">
                          {st.name}
                        </td>
                        {daysArray.map((day) => {
                          const isHoliday = holidayDayNumbers.has(day);
                          const status = gridData[st.id]?.[day] || '';

                          return (
                            <td
                              key={day}
                              onClick={() => handleToggleCell(st.id, day)}
                              onKeyDown={(e) => handleKeyShortcut(st.id, day, e.key)}
                              tabIndex={isHoliday ? -1 : 0}
                              className={`p-0.5 select-none transition-colors ${
                                isHoliday
                                  ? 'bg-surface-100/50 dark:bg-surface-950/40 cursor-not-allowed'
                                  : 'cursor-pointer hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-primary-500'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-xs ${
                                  status === 'P'
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : status === 'A'
                                    ? 'bg-rose-500 text-white shadow-xs'
                                    : status === 'L'
                                    ? 'bg-amber-400 text-amber-950 shadow-xs'
                                    : isHoliday
                                    ? 'text-surface-300 dark:text-surface-600'
                                    : 'text-surface-300 dark:text-surface-600 hover:bg-surface-200/50 dark:hover:bg-surface-700'
                                }`}
                              >
                                {isHoliday ? '—' : status || '·'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleFillPresent(st.id)}
                            className="text-[10px] px-2 py-1 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 hover:text-emerald-600 font-semibold"
                            title="Fill all remaining empty days with Present"
                          >
                            All P
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* TAB 2: AI REGISTER SCANNER (LOCKED - premium, not released) */}
      {/* -------------------------------------------------------------- */}
      {/* This feature previously fabricated attendance with Math.random()
          and would have written invented Present/Absent marks into the
          database. It is now fully inert: no upload, no fake rows, no save. */}
      {activeTab === 'ai-scanner' && (
        <div className="space-y-6">
          <Card className="p-8 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-glow relative">
                <Camera size={28} />
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-surface-900 flex items-center justify-center text-sm shadow">
                  🔒
                </span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                  {t('att.ai_scanner')}
                </h3>
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                  {t('att.premium')} · {t('att.coming_soon')}
                </span>
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                {t('att.scanner_locked_desc')}
              </p>

              <div className="rounded-2xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 p-4 text-left">
                <p className="text-[11px] font-semibold text-surface-700 dark:text-surface-200 mb-2">
                  What it will do when released:
                </p>
                <ul className="text-[11px] text-surface-500 dark:text-surface-400 space-y-1.5 list-disc list-inside">
                  <li>Photograph a handwritten attendance register</li>
                  <li>Detect student names and mark Present / Absent / Leave</li>
                  <li>Let you correct anything before saving</li>
                </ul>
              </div>

              <Button variant="secondary" className="w-full" disabled>
                <Upload size={16} />
                {t('att.coming_soon')}
              </Button>

              <p className="text-[10px] text-surface-400">
                Use the manual entry tab to record attendance in the meantime.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* TAB 3: MONTHLY ATTENDANCE SUMMARY & DEFAULTERS */}
      {/* -------------------------------------------------------------- */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                  Monthly Defaulter & Attendance Analysis
                </h3>
                <p className="text-xs text-surface-400">
                  Formula: (Present + Allowed Leaves [Max 4]) / Total Working Days × 100
                </p>
              </div>
              <span className="badge-danger">
                {summaryList.filter((s) => s.isDefaulter).length} Defaulters below 70%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                  <tr>
                    <th className="px-6 py-3.5">{t('common.name')}</th>
                    <th className="px-6 py-3.5 text-center">{t('att.present')}</th>
                    <th className="px-6 py-3.5 text-center">{t('att.leave')}</th>
                    <th className="px-6 py-3.5 text-center">{t('att.absent')}</th>
                    <th className="px-6 py-3.5 text-center">{t('att.attendance_pct')}</th>
                    <th className="px-6 py-3.5 text-right">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {summaryList.map((item) => (
                    <tr
                      key={item.student.id}
                      className={`hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors ${
                        item.isDefaulter ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="px-6 py-3.5 font-medium text-surface-900 dark:text-white">
                        {item.student.name}
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold text-emerald-600">
                        {item.presentCount}
                      </td>
                      <td className="px-6 py-3.5 text-center font-semibold text-amber-600">
                        {item.leaveCount} (Credit: {item.allowedLeavesCredited})
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold text-rose-600">
                        {item.absentCount}
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold text-base">
                        <span
                          className={
                            item.isDefaulter ? 'text-rose-600 font-extrabold' : 'text-emerald-600'
                          }
                        >
                          {item.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {item.isDefaulter ? (
                          <span className="badge-danger">
                            {t('att.defaulter')}
                          </span>
                        ) : (
                          <span className="badge-success">
                            {t('att.good_standing')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
