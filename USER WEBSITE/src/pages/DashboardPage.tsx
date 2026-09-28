// ============================================
// Main Dashboard Page (Teacher View)
// Real-time stats, Defaulters alert, and Quick Action cards
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  BookOpen,
  CalendarDays,
  Receipt,
  ArrowRight,
  AlertTriangle,
  Zap,
  Plus,
  CheckCircle,
} from 'lucide-react';
import { Card, Button, Spinner } from '../components/ui';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService, DEFAULT_RULES, type AttendanceRules } from '../services/db';
import { daysInMonth as daysInMonthForKey, isValidMonthKey } from '../lib/utils';
import type { Batch, Student, Fine, Holiday, Attendance } from '../types/database';

export default function DashboardPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Real rules from Settings rather than a hardcoded leave allowance.
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_RULES);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

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

      const sIds = sList.map((s) => s.id);
      if (sIds.length > 0) {
        const [fList, aList] = await Promise.all([
          dbService.getFines(currentMonth, sIds),
          dbService.getMonthlyAttendance(currentMonth, sIds),
        ]);
        setFines(fList);
        setAttendance(aList);
      } else {
        setFines([]);
        setAttendance([]);
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Metrics
  const pendingFinesTotal = useMemo(() => {
    return fines
      .filter((f) => f.status === 'pending')
      .reduce((acc, f) => acc + Number(f.amount || 0), 0);
  }, [fines]);

  // Defaulters List
  const defaulters = useMemo(() => {
    if (!isValidMonthKey(currentMonth)) return [];
    const daysInMonth = daysInMonthForKey(currentMonth);
    const hDates = holidays.map((h) => h.date);

    return students
      .map((st) => {
        const records = attendance.filter((a) => a.student_id === st.id);
        const calc = dbService.calculateStudentAttendance(
          records,
          daysInMonth,
          hDates,
          currentMonth,
          rules.maxAllowedLeaves,
          rules.minAttendancePercent
        );
        return {
          student: st,
          ...calc,
        };
      })
      // Only students who actually have marks can be defaulters. The service
      // already reports hasRecords: false for unmarked students, and this keeps
      // the dashboard consistent with Reports and Fines.
      .filter((s) => s.hasRecords && s.isDefaulter);
  }, [students, attendance, holidays, currentMonth, rules]);

  return (
    <div className="animate-slide-up space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-primary-600 to-indigo-700 text-white shadow-glow relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs uppercase tracking-widest text-primary-200 font-semibold">
            {t('nav.active_teacher')}
          </span>
          <h1 className="text-2xl font-bold mt-0.5">
            {currentTeacher ? currentTeacher.name : t('nav.no_teacher')}
          </h1>
          <p className="text-xs text-primary-100 mt-1 max-w-xl">
            {currentTeacher
              ? 'Here is your monthly tuition summary, attendance tracker, and fine collection status.'
              : 'Loading your account profile…'}
          </p>
        </div>

        <div className="relative z-10 flex gap-2">
          <Link to="/attendance">
            <button className="px-4 py-2 rounded-xl bg-white text-primary-700 hover:bg-primary-50 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
              <CalendarDays size={14} />
              <span>Mark Attendance</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Batches */}
        <Link to="/batches" className="group">
          <Card className="hover:border-primary-400/50 transition-all p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="stat-label">{t('nav.batches')}</span>
                <p className="stat-value mt-1">
                  {loading ? '...' : batches.length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                <BookOpen size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-surface-400 group-hover:text-primary-600 transition-colors">
              <span>View batches</span>
              <ArrowRight size={12} />
            </div>
          </Card>
        </Link>

        {/* Students */}
        <Link to="/students" className="group">
          <Card className="hover:border-cyan-400/50 transition-all p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="stat-label">{t('nav.students')}</span>
                <p className="stat-value mt-1">
                  {loading ? '...' : students.length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-surface-400 group-hover:text-cyan-600 transition-colors">
              <span>Manage students</span>
              <ArrowRight size={12} />
            </div>
          </Card>
        </Link>

        {/* Attendance Marks */}
        <Link to="/attendance" className="group">
          <Card className="hover:border-emerald-400/50 transition-all p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="stat-label">Attendance Entries</span>
                <p className="stat-value mt-1">
                  {loading ? '...' : attendance.length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CalendarDays size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-surface-400 group-hover:text-emerald-600 transition-colors">
              <span>Open register</span>
              <ArrowRight size={12} />
            </div>
          </Card>
        </Link>

        {/* Pending Fines */}
        <Link to="/fines" className="group">
          <Card className="hover:border-amber-400/50 transition-all p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="stat-label">{t('fines.pending_amount')}</span>
                <p className="stat-value text-amber-600 dark:text-amber-400 mt-1">
                  {loading ? '...' : `PKR ${pendingFinesTotal.toLocaleString()}`}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Receipt size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-surface-400 group-hover:text-amber-600 transition-colors">
              <span>View fines</span>
              <ArrowRight size={12} />
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Defaulter Alert List */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              Low Attendance Defaulters (&lt;70%)
            </h3>
            <span className="badge-danger text-[11px]">
              {defaulters.length} Students
            </span>
          </div>

          {defaulters.length === 0 ? (
            <div className="py-8 text-center text-xs text-surface-400">
              <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
              No defaulters found this month. Attendance rates are healthy!
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto text-xs">
              {defaulters.map((item) => (
                <div key={item.student.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-surface-900 dark:text-white">
                      {item.student.name}
                    </span>
                    <div className="text-[11px] text-surface-400">
                      Present: {item.presentCount} | Leaves: {item.leaveCount} | Absents: {item.absentCount}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-rose-600">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link to="/fines">
            <button className="w-full py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-xs font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-200 transition-colors flex items-center justify-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              Run Auto-Fine Calculation →
            </button>
          </Link>
        </Card>

        {/* Quick Setup & Management */}
        <Card className="space-y-4">
          <h3 className="font-bold text-sm text-surface-900 dark:text-white">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/students" className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 hover:border-primary-400 transition-all flex flex-col justify-between">
              <Users size={18} className="text-primary-500 mb-2" />
              <div className="font-semibold text-xs text-surface-900 dark:text-white">Add Students</div>
              <div className="text-[10px] text-surface-400">Manual or CSV bulk</div>
            </Link>

            <Link to="/attendance" className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 hover:border-emerald-400 transition-all flex flex-col justify-between">
              <CalendarDays size={18} className="text-emerald-500 mb-2" />
              <div className="font-semibold text-xs text-surface-900 dark:text-white">AI Scanner</div>
              <div className="text-[10px] text-surface-400">Scan physical register</div>
            </Link>

            <Link to="/holidays" className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 hover:border-rose-400 transition-all flex flex-col justify-between">
              <CalendarDays size={18} className="text-rose-500 mb-2" />
              <div className="font-semibold text-xs text-surface-900 dark:text-white">Mark Holiday</div>
              <div className="text-[10px] text-surface-400">Deduct working days</div>
            </Link>

            <Link to="/reports" className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 hover:border-indigo-400 transition-all flex flex-col justify-between">
              <BarChart3 size={18} className="text-indigo-500 mb-2" />
              <div className="font-semibold text-xs text-surface-900 dark:text-white">Export Reports</div>
              <div className="text-[10px] text-surface-400">PDF & CSV download</div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
