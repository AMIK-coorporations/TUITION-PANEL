// ============================================
// Reports & Analytics Page (Teacher View)
// Attendance trends, Defaulter tracking, Revenue collection & Exports
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  ArrowUpDown,
  Printer,
  DollarSign,
} from 'lucide-react';
import { Card, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService, DEFAULT_RULES, type AttendanceRules } from '../services/db';
import { downloadCsv } from '../lib/utils';
import type { Student, Holiday, Attendance, Fine } from '../types/database';

export default function ReportsPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [students, setStudents] = useState<(Student & { batch_name?: string })[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  // Real rules from Settings (previously hardcoded 4 and 70).
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_RULES);

  // Guard the empty picker so the maths never becomes NaN.
  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return 0;
    }
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  const loadData = useCallback(async () => {
    if (!currentTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [sList, hList, loadedRules] = await Promise.all([
        dbService.getStudents(currentTeacher.id),
        dbService.getHolidays(currentTeacher.id),
        dbService.getRules(currentTeacher.id),
      ]);
      setStudents(sList);
      setHolidays(hList);
      setRules(loadedRules);

      const sIds = sList.map((s) => s.id);
      if (sIds.length > 0) {
        const [attList, fList] = await Promise.all([
          dbService.getMonthlyAttendance(selectedMonth, sIds),
          dbService.getFines(selectedMonth, sIds),
        ]);
        setAttendance(attList);
        setFines(fList);
      } else {
        setAttendance([]);
        setFines([]);
      }
    } catch (err) {
      console.warn('Reports load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations per student
  const studentReports = useMemo(() => {
    const hDates = holidays.map((h) => h.date);

    const list = students.map((st) => {
      const records = attendance.filter((a) => a.student_id === st.id);
      const calc = dbService.calculateStudentAttendance(
        records,
        daysInMonth,
        hDates,
        selectedMonth,
        rules.maxAllowedLeaves,
        rules.minAttendancePercent
      );

      // Student fines. Cancelled fines are excluded from money totals because
      // they were waived - counting them over-stated what was owed/collected.
      const stFines = fines.filter((f) => f.student_id === st.id);
      const billableFines = stFines.filter((f) => f.status !== 'cancelled');
      const totalFine = billableFines.reduce((acc, f) => acc + Number(f.amount || 0), 0);
      const paidFine = billableFines
        .filter((f) => f.status === 'paid')
        .reduce((acc, f) => acc + Number(f.amount || 0), 0);

      return {
        student: st,
        ...calc,
        hasRecords: calc.hasRecords,
        totalFine,
        paidFine,
        pendingFine: totalFine - paidFine,
      };
    });

    list.sort((a, b) => {
      return sortOrder === 'asc'
        ? a.percentage - b.percentage
        : b.percentage - a.percentage;
    });

    return list;
  }, [students, attendance, holidays, daysInMonth, selectedMonth, fines, sortOrder, rules]);

  // Students who actually have marks this month. Averages and the defaulter
  // count are computed from these only, so an unmarked student is neither
  // reported as 0% nor counted as a defaulter.
  const markedReports = useMemo(
    () => studentReports.filter((s) => s.hasRecords),
    [studentReports]
  );

  // Aggregates
  const stats = useMemo(() => {
    if (markedReports.length === 0) {
      return { avgAttendance: 0, defaulterCount: 0, totalFineAmt: 0, paidFineAmt: 0 };
    }
    const totalPct = markedReports.reduce((acc, s) => acc + s.percentage, 0);
    const defaulters = markedReports.filter((s) => s.isDefaulter).length;
    const totalFineAmt = markedReports.reduce((acc, s) => acc + s.totalFine, 0);
    const paidFineAmt = markedReports.reduce((acc, s) => acc + s.paidFine, 0);

    return {
      avgAttendance: Math.round(totalPct / markedReports.length),
      defaulterCount: defaulters,
      totalFineAmt,
      paidFineAmt,
    };
  }, [studentReports]);

  // Export CSV
  const handleExportCsv = () => {
    if (studentReports.length === 0) {
      showToast('No report data to export', 'error');
      return;
    }

    const headers = [
      'Student Name',
      'Batch',
      'Present Days',
      'Leave Days',
      'Absent Days',
      'Attendance %',
      'Defaulter Status',
      'Total Fines (PKR)',
      'Paid Fines (PKR)',
    ];

    const rows = studentReports.map((r) => [
      r.student.name,
      r.student.batch_name || '',
      r.presentCount,
      r.leaveCount,
      r.absentCount,
      `${r.percentage}%`,
      // Threshold comes from Settings, not a hardcoded 70.
      r.hasRecords
        ? r.isDefaulter
          ? `Defaulter (<${rules.minAttendancePercent}%)`
          : 'Good Standing'
        : 'No attendance recorded',
      r.totalFine,
      r.paidFine,
    ]);

    // Shared helper: adds a UTF-8 BOM (so Excel renders Urdu correctly) and
    // revokes the object URL afterwards instead of leaking it.
    downloadCsv(`Tuition_Report_${selectedMonth}.csv`, headers, rows);
    showToast('Report exported', 'success');
  };

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('nav.reports')}</h1>
            <p className="page-subtitle">Monthly analytics and student performance summaries</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input py-1.5 text-xs w-36"
            aria-label="Select report month"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportCsv}
          >
            {t('common.export_csv')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Printer size={14} />}
            onClick={() => window.print()}
          >
            {t('common.export_pdf')}
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="stat-label">Average Attendance</span>
          <p className="stat-value text-indigo-600 mt-1">{stats.avgAttendance}%</p>
          <p className="text-xs text-surface-400 mt-1">Across all registered students</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <span className="stat-label text-rose-600">Defaulter Students</span>
          <p className="stat-value text-rose-600 mt-1">{stats.defaulterCount}</p>
          <p className="text-xs text-surface-400 mt-1">Below 70% threshold</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <span className="stat-label text-emerald-600">Fines Collected</span>
          <p className="stat-value text-emerald-600 mt-1">
            PKR {stats.paidFineAmt.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-1">Received this month</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="stat-label text-amber-600">Total Fines Issued</span>
          <p className="stat-value text-amber-600 mt-1">
            PKR {stats.totalFineAmt.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-1">Pending + Paid</p>
        </Card>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : studentReports.length === 0 ? (
        <Card className="text-center py-16">
          <BarChart3 size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300">
            {t('common.empty')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            No attendance records or students found for {selectedMonth}.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
            <h3 className="font-bold text-sm text-surface-900 dark:text-white">
              Student Monthly Breakdown ({selectedMonth})
            </h3>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1.5"
            >
              <ArrowUpDown size={12} />
              Sort Attendance ({sortOrder === 'asc' ? 'Lowest First' : 'Highest First'})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5 text-center">P / L / A</th>
                  <th className="px-6 py-3.5 text-center">Attendance %</th>
                  <th className="px-6 py-3.5 text-center">Attendance Bar</th>
                  <th className="px-6 py-3.5 text-right">Fines (Total / Paid)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {studentReports.map((r) => (
                  <tr
                    key={r.student.id}
                    className={`hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors ${
                      r.isDefaulter ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    <td className="px-6 py-3.5 font-medium text-surface-900 dark:text-white">
                      <div>{r.student.name}</div>
                      <div className="text-[11px] text-surface-400 font-normal">
                        {r.student.batch_name}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center text-xs font-mono">
                      <span className="text-emerald-600 font-bold">{r.presentCount}P</span> /{' '}
                      <span className="text-amber-600 font-semibold">{r.leaveCount}L</span> /{' '}
                      <span className="text-rose-600 font-bold">{r.absentCount}A</span>
                    </td>
                    <td className="px-6 py-3.5 text-center font-bold font-mono">
                      <span className={r.isDefaulter ? 'text-rose-600 font-extrabold' : 'text-emerald-600'}>
                        {r.percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-3.5 min-w-[140px]">
                      <div className="w-full bg-surface-100 dark:bg-surface-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.isDefaulter ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs font-semibold">
                      {r.totalFine > 0 ? (
                        <span>
                          PKR {r.totalFine} /{' '}
                          <span className="text-emerald-600">PKR {r.paidFine}</span>
                        </span>
                      ) : (
                        <span className="text-surface-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
