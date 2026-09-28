// ============================================
// Fine Management System & Auto-Calculation
// Auto-Fines for low attendance + Custom disciplinary fines
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Trash2,
  AlertCircle,
  DollarSign,
  X,
  Filter,
} from 'lucide-react';
import { Card, Input, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService, DEFAULT_RULES, type AttendanceRules } from '../services/db';
import type { Student, Fine, Holiday, Attendance } from '../types/database';

export default function FinesPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const [fines, setFines] = useState<Fine[]>([]);
  const [students, setStudents] = useState<(Student & { batch_name?: string })[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  // Real rules from the Settings page. Previously the page hardcoded both the
  // 4-leave allowance and the PKR 500 amount, so changing Settings did nothing.
  const [rules, setRules] = useState<AttendanceRules>(DEFAULT_RULES);

  // Custom Fine Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStudentId, setCustomStudentId] = useState('');
  const [customAmount, setCustomAmount] = useState('500');
  const [customLabel, setCustomLabel] = useState('Late Coming');
  const [savingCustom, setSavingCustom] = useState(false);

  // Auto-Fine Preview Modal
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [calculatingAuto, setCalculatingAuto] = useState(false);
  const [autoPreviewList, setAutoPreviewList] = useState<
    { student: Student; attendancePct: number; amount: number; label: string }[]
  >([]);
  const [savingAuto, setSavingAuto] = useState(false);

  // Mark as Paid Popup
  const [payingFine, setPayingFine] = useState<Fine | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [markingPaid, setMarkingPaid] = useState(false);

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

      const studentIds = sList.map((s) => s.id);
      if (studentIds.length > 0) {
        const fList = await dbService.getFines(selectedMonth, studentIds);
        setFines(fList);
      } else {
        setFines([]);
      }

      if (sList.length > 0 && !customStudentId) {
        setCustomStudentId(sList[0].id);
      }
    } catch (err) {
      console.warn('Fines load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher, selectedMonth, customStudentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Student map
  const studentMap = useMemo(() => {
    const map: Record<string, Student & { batch_name?: string }> = {};
    students.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  // Filtered fines
  const filteredFines = useMemo(() => {
    return fines.filter((f) => {
      if (statusFilter === 'all') return true;
      return f.status === statusFilter;
    });
  }, [fines, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    let pendingAmt = 0;
    let paidAmt = 0;
    let cancelledAmt = 0;

    fines.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.status === 'pending') pendingAmt += amt;
      else if (f.status === 'paid') paidAmt += amt;
      else if (f.status === 'cancelled') cancelledAmt += amt;
    });

    return {
      totalCount: fines.length,
      pendingAmt,
      paidAmt,
      cancelledAmt,
      totalAmt: pendingAmt + paidAmt,
    };
  }, [fines]);

  // Run Auto-Fine Calculation & Preview
  const handleTriggerAutoFines = async () => {
    if (students.length === 0) {
      showToast('No students registered for auto calculation', 'error');
      return;
    }

    setCalculatingAuto(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const studentIds = students.map((s) => s.id);
      const holidayDates = holidays.map((h) => h.date);

      const attendanceRecords = await dbService.getMonthlyAttendance(selectedMonth, studentIds);

      // Check which students already have an auto fine this month
      const existingAutoFines = fines.filter((f) => f.type === 'auto');
      const existingFinedStudentIds = new Set(existingAutoFines.map((f) => f.student_id));

      const previews: {
        student: Student;
        attendancePct: number;
        amount: number;
        label: string;
      }[] = [];

      students.forEach((st) => {
        // Exclude if already has auto fine
        if (existingFinedStudentIds.has(st.id)) return;

        // Only consider students who actually have marks this month. A student
        // with zero marks was previously treated as 0% and fined, even though
        // nobody had recorded anything for them.
        const records = attendanceRecords.filter((a) => a.student_id === st.id);
        if (records.length === 0) return;

        const calc = dbService.calculateStudentAttendance(
          records,
          daysInMonth,
          holidayDates,
          selectedMonth,
          rules.maxAllowedLeaves,
          rules.minAttendancePercent
        );

        // hasRecords is false when every mark fell on a holiday, etc.
        if (!calc.hasRecords) return;

        if (calc.isDefaulter) {
          previews.push({
            student: st,
            attendancePct: calc.percentage,
            amount: rules.fineAmount,
            label: `Low Attendance (${calc.percentage}%)`,
          });
        }
      });

      setAutoPreviewList(previews);
      setShowAutoModal(true);

      if (previews.length === 0) {
        showToast('All students meet attendance criteria! No new defaulters.', 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calculation error';
      showToast(msg, 'error');
    } finally {
      setCalculatingAuto(false);
    }
  };

  // Confirm Auto-Fines creation
  const handleConfirmAutoFines = async () => {
    setSavingAuto(true);
    try {
      const records = autoPreviewList.map((p) => ({
        student_id: p.student.id,
        month: selectedMonth,
        amount: p.amount,
        label: p.label,
        type: 'auto' as const,
      }));

      await dbService.bulkCreateFines(records);
      showToast(`Created ${records.length} auto-fines!`, 'success');
      setShowAutoModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      showToast(msg, 'error');
    } finally {
      setSavingAuto(false);
    }
  };

  // Create Custom Fine
  const handleCreateCustomFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStudentId || !customAmount || !customLabel.trim()) {
      showToast('Please fill all fields', 'error');
      return;
    }

    setSavingCustom(true);
    try {
      await dbService.createFine(
        customStudentId,
        selectedMonth,
        Number(customAmount),
        customLabel.trim(),
        'custom'
      );
      showToast('Custom fine created successfully!', 'success');
      setShowCustomModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      showToast(msg, 'error');
    } finally {
      setSavingCustom(false);
    }
  };

  // Confirm Mark as Paid
  const handleConfirmMarkPaid = async () => {
    if (!payingFine) return;
    setMarkingPaid(true);
    try {
      await dbService.markFineAsPaid(payingFine.id, paymentDate);
      showToast('Fine marked as paid!', 'success');
      setPayingFine(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update error';
      showToast(msg, 'error');
    } finally {
      setMarkingPaid(false);
    }
  };

  // Cancel Fine
  const handleCancelFine = async (fineId: string) => {
    const ok = window.confirm('Are you sure you want to cancel this fine?');
    if (!ok) return;

    try {
      await dbService.cancelFine(fineId);
      showToast('Fine marked as cancelled', 'info');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancel error';
      showToast(msg, 'error');
    }
  };

  // Soft Delete Fine
  const handleDeleteFine = async (fineId: string) => {
    const ok = window.confirm('Move this fine to Recycle Bin?');
    if (!ok) return;

    try {
      await dbService.softDeleteFine(fineId);
      showToast('Fine moved to Recycle Bin', 'info');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete error';
      showToast(msg, 'error');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (fines.length === 0) {
      showToast('No fines to export', 'error');
      return;
    }

    const headers = ['Student Name', 'Batch', 'Month', 'Amount (PKR)', 'Label', 'Type', 'Status', 'Payment Date'];
    const rows = fines.map((f) => {
      const st = studentMap[f.student_id];
      return [
        `"${st?.name || 'Unknown'}"`,
        `"${st?.batch_name || 'Batch'}"`,
        `"${f.month}"`,
        f.amount,
        `"${f.label}"`,
        f.type,
        f.status,
        `"${f.payment_date || 'N/A'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fines_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentTeacher) {
    return (
      <div className="p-8 text-center glass-card max-w-lg mx-auto my-12">
        <AlertCircle size={40} className="mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-surface-800 dark:text-white">
          {t('nav.no_teacher')}
        </h2>
        <p className="text-sm text-surface-500 mt-2">
          {t('teacher.select_prompt')}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-glow">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('fines.title')}</h1>
            <p className="page-subtitle">{t('fines.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={handleExportCsv}
          >
            {t('common.export_csv')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowCustomModal(true)}
            disabled={students.length === 0}
          >
            {t('fines.add_custom')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Zap size={14} />}
            loading={calculatingAuto}
            onClick={handleTriggerAutoFines}
          >
            {t('fines.run_auto')}
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="stat-label">{t('fines.total_fines')}</span>
          <p className="stat-value mt-1">{metrics.totalCount}</p>
          <p className="text-xs text-surface-400 mt-1">For month {selectedMonth}</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="stat-label text-amber-600 dark:text-amber-400">
            {t('fines.pending_amount')}
          </span>
          <p className="stat-value text-amber-600 mt-1">
            PKR {metrics.pendingAmt.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            {fines.filter((f) => f.status === 'pending').length} unpaid records
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <span className="stat-label text-emerald-600 dark:text-emerald-400">
            {t('fines.paid_amount')}
          </span>
          <p className="stat-value text-emerald-600 mt-1">
            PKR {metrics.paidAmt.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-1">
            {fines.filter((f) => f.status === 'paid').length} collected
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-surface-400">
          <span className="stat-label">Cancelled Fines</span>
          <p className="stat-value text-surface-500 mt-1">
            PKR {metrics.cancelledAmt.toLocaleString()}
          </p>
          <p className="text-xs text-surface-400 mt-1">Waived or void</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input py-2 text-sm w-full sm:w-48"
              aria-label="Filter fines by month"
            />
          </div>

          <div className="flex bg-surface-100 dark:bg-surface-800 p-1 rounded-2xl border border-surface-200 dark:border-surface-700 w-full sm:w-auto">
            {(['all', 'pending', 'paid', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all flex-1 sm:flex-initial ${
                  statusFilter === st
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Fines Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : filteredFines.length === 0 ? (
        <Card className="text-center py-16">
          <Receipt size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300">
            {t('common.empty')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            No fines found for {selectedMonth}. Run auto calculation or add a custom fine.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-3.5">{t('common.name')}</th>
                  <th className="px-6 py-3.5">Reason / Label</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">{t('common.status')}</th>
                  <th className="px-6 py-3.5">{t('fines.payment_date')}</th>
                  <th className="px-6 py-3.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filteredFines.map((fine) => {
                  const student = studentMap[fine.student_id];
                  return (
                    <tr
                      key={fine.id}
                      className="hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors"
                    >
                      <td className="px-6 py-3.5 font-medium text-surface-900 dark:text-white">
                        <div>{student?.name || 'Unknown'}</div>
                        <div className="text-[11px] text-surface-400 font-normal">
                          {student?.batch_name}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-surface-700 dark:text-surface-300 font-medium">
                        {fine.label}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="badge bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 uppercase text-[10px]">
                          {fine.type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-bold font-mono text-surface-900 dark:text-white">
                        PKR {Number(fine.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        {fine.status === 'paid' ? (
                          <span className="badge-success">Paid</span>
                        ) : fine.status === 'pending' ? (
                          <span className="badge-warning">Pending</span>
                        ) : (
                          <span className="badge bg-surface-200 text-surface-600">Cancelled</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-surface-500 font-mono">
                        {fine.payment_date || '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-1.5 rtl:space-x-reverse whitespace-nowrap">
                        {fine.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => setPayingFine(fine)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                          >
                            Mark Paid
                          </button>
                        )}
                        {fine.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCancelFine(fine.id)}
                            className="px-2 py-1 text-xs text-surface-500 hover:text-surface-800"
                            title="Cancel Fine"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFine(fine.id)}
                          className="p-1 text-surface-400 hover:text-rose-500 rounded"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mark As Paid Date Popup */}
      {payingFine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 max-w-sm w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <h3 className="font-bold text-base text-surface-900 dark:text-white mb-2">
              {t('fines.confirm_payment')}
            </h3>
            <p className="text-xs text-surface-500 mb-4">
              Student: <strong>{studentMap[payingFine.student_id]?.name}</strong>
              <br />
              Amount: <strong>PKR {Number(payingFine.amount).toLocaleString()}</strong>
            </p>

            <div className="space-y-4">
              <Input
                label={t('fines.payment_date')}
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setPayingFine(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  loading={markingPaid}
                  onClick={handleConfirmMarkPaid}
                >
                  Confirm Paid
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Fine Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 max-w-md w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                {t('fines.add_custom')}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomFine} className="space-y-4">
              <div>
                <label className="input-label">Select Student</label>
                <select
                  className="select text-sm"
                  value={customStudentId}
                  onChange={(e) => setCustomStudentId(e.target.value)}
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.batch_name})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Fine Amount (PKR)"
                type="number"
                min="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                required
              />

              <Input
                label="Reason / Label"
                placeholder="e.g. Late Coming, Incomplete Homework, Discipline"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                required
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCustomModal(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={savingCustom}
                >
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Fine Preview Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 max-w-lg w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-surface-900 dark:text-white flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  Auto-Fine Calculation Preview ({selectedMonth})
                </h3>
                <p className="text-xs text-surface-400 mt-0.5">
                  Identified students with attendance &lt; 70%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoModal(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600"
              >
                <X size={18} />
              </button>
            </div>

            {autoPreviewList.length === 0 ? (
              <div className="py-8 text-center text-sm text-surface-500">
                🎉 No students below 70% attendance threshold!
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800">
                  {autoPreviewList.map((item, idx) => (
                    <div key={item.student.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-surface-900 dark:text-white">{item.student.name}</span>
                        <div className="text-rose-500 font-semibold">
                          Attendance: {item.attendancePct}% (&lt;70%)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">PKR</span>
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAutoPreviewList((prev) => {
                              const c = [...prev];
                              c[idx].amount = val;
                              return c;
                            });
                          }}
                          className="w-20 px-2 py-1 text-xs border rounded-lg text-right font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowAutoModal(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-1"
                    loading={savingAuto}
                    onClick={handleConfirmAutoFines}
                  >
                    Confirm & Apply Fines ({autoPreviewList.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
