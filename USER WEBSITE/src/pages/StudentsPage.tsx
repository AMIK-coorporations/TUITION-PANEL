// ============================================
// Students Management Page
// Table view, Batch Grouping, Soft-delete & Bulk CSV Import
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Upload,
  Trash2,
  Phone,
  FileSpreadsheet,
  AlertCircle,
  X,
} from 'lucide-react';
import { Card, Input, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService } from '../services/db';
import { parseStudentCsv } from '../lib/utils';
import type { Batch, Student } from '../types/database';

export default function StudentsPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<(Student & { batch_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');

  // Add Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentBatchId, setNewStudentBatchId] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // Bulk CSV Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvTargetBatchId, setCsvTargetBatchId] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [bList, sList] = await Promise.all([
        dbService.getBatches(currentTeacher.id),
        dbService.getStudents(currentTeacher.id),
      ]);
      setBatches(bList);
      setStudents(sList);
      if (bList.length > 0 && !newStudentBatchId) {
        setNewStudentBatchId(bList[0].id);
        setCsvTargetBatchId(bList[0].id);
      }
    } catch (err) {
      console.warn('Load students error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher, newStudentBatchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone.includes(searchQuery);
      const matchesBatch =
        selectedBatchId === 'all' || student.batch_id === selectedBatchId;
      return matchesSearch && matchesBatch;
    });
  }, [students, searchQuery, selectedBatchId]);

  // Handle Add Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentBatchId) {
      showToast('Please provide student name and select a batch', 'error');
      return;
    }

    setSavingStudent(true);
    try {
      await dbService.createStudent(
        newStudentName.trim(),
        newStudentPhone.trim(),
        newStudentBatchId
      );
      showToast(`Student "${newStudentName.trim()}" added successfully!`, 'success');
      setNewStudentName('');
      setNewStudentPhone('');
      setShowAddModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add student';
      showToast(msg, 'error');
    } finally {
      setSavingStudent(false);
    }
  };

  // Handle Soft Delete
  const handleDeleteStudent = async (studentId: string, name: string) => {
    const ok = window.confirm(`Move "${name}" to Recycle Bin? You can restore it within 30 days.`);
    if (!ok) return;

    try {
      await dbService.softDeleteStudent(studentId);
      showToast(`Student moved to Recycle Bin`, 'info');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      showToast(msg, 'error');
    }
  };

  // Handle Bulk CSV
  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      showToast('Please paste CSV text or upload a CSV file', 'error');
      return;
    }
    if (!csvTargetBatchId) {
      showToast('Please choose a target batch', 'error');
      return;
    }

    setImportingCsv(true);
    try {
      // Shared parser handles quoted fields, commas inside quotes, CRLF and
      // blank lines, and skips a "name,phone" header row. The old inline
      // version split on ',' only, so a quoted name like "Ahmed, Sara" broke.
      const parsed = parseStudentCsv(csvText);

      // Optional third column: batch name. Falls back to the selected batch.
      const batchIdByName: Record<string, string> = {};
      batches.forEach((b) => {
        batchIdByName[b.name.trim().toLowerCase()] = b.id;
      });

      const toInsert: { name: string; phone: string; batch_id: string }[] = [];
      let unmatchedBatchRows = 0;

      parsed.forEach((row) => {
        let batchId = csvTargetBatchId;
        if (row.batchName) {
          const matched = batchIdByName[row.batchName.toLowerCase()];
          if (matched) {
            batchId = matched;
          } else {
            // Unknown batch name: keep the row but use the chosen batch.
            unmatchedBatchRows++;
          }
        }
        toInsert.push({ name: row.name, phone: row.phone, batch_id: batchId });
      });

      if (toInsert.length === 0) {
        showToast('No valid student rows found in CSV', 'error');
        return;
      }

      const inserted = await dbService.bulkCreateStudents(toInsert);
      showToast(`Successfully imported ${inserted} students!`, 'success');
      if (unmatchedBatchRows > 0) {
        showToast(
          `${unmatchedBatchRows} row(s) had an unknown batch name and were added to the selected batch.`,
          'info'
        );
      }
      setCsvText('');
      setShowCsvModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CSV import failed';
      showToast(msg, 'error');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  if (!currentTeacher) {
    return (
      <div className="p-8 text-center glass-card max-w-lg mx-auto my-12">
        <AlertCircle size={40} className="mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-surface-800 dark:text-white">
          Loading your profile…
        </h2>
        <p className="text-sm text-surface-500 mt-2">
          Your account profile could not be loaded yet. Please wait a moment or reload the page.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-glow">
            <Users size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('student.title')}</h1>
            <p className="page-subtitle">
              {filteredStudents.length} {t('common.total')} • {currentTeacher.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet size={15} />}
            onClick={() => setShowCsvModal(true)}
          >
            {t('student.bulk_import')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setShowAddModal(true)}
            disabled={batches.length === 0}
          >
            {t('student.add_student')}
          </Button>
        </div>
      </div>

      {batches.length === 0 && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
          <span>⚠️ Please create at least one Batch before adding students.</span>
          <a href="/batches" className="font-bold underline">Go to Batches →</a>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              icon={<Search size={16} />}
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              className="select text-sm w-full"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              aria-label="Filter by batch"
            >
              <option value="all">📁 {t('common.all')} {t('nav.batches')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Students Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="text-center py-16">
          <Users size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300">
            {t('common.empty')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            No students found matching your criteria.
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs font-semibold text-surface-500 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                <tr>
                  <th className="px-6 py-3.5">#</th>
                  <th className="px-6 py-3.5">{t('common.name')}</th>
                  <th className="px-6 py-3.5">{t('common.batch')}</th>
                  <th className="px-6 py-3.5">{t('common.phone')}</th>
                  <th className="px-6 py-3.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filteredStudents.map((student, idx) => (
                  <tr
                    key={student.id}
                    className="hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors"
                  >
                    <td className="px-6 py-3.5 text-xs text-surface-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-surface-900 dark:text-white">
                      {student.name}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="badge bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300">
                        {student.batch_name}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-surface-500 text-xs font-mono">
                      {student.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} /> {student.phone}
                        </span>
                      ) : (
                        <span className="text-surface-300 dark:text-surface-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        className="p-1.5 text-surface-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 max-w-md w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-surface-900 dark:text-white">
                {t('student.add_student')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <Input
                label={t('common.name')}
                placeholder="Student Full Name (e.g. Ali Khan)"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                required
              />
              <Input
                label={t('common.phone')}
                placeholder="0300-1234567"
                value={newStudentPhone}
                onChange={(e) => setNewStudentPhone(e.target.value)}
              />
              <div>
                <label className="input-label">{t('common.batch')}</label>
                <select
                  className="select text-sm"
                  value={newStudentBatchId}
                  onChange={(e) => setNewStudentBatchId(e.target.value)}
                  required
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  loading={savingStudent}
                >
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 max-w-lg w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-surface-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-primary-500" />
                {t('student.bulk_import')}
              </h3>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="input-label">Select Target Batch</label>
                <select
                  className="select text-sm"
                  value={csvTargetBatchId}
                  onChange={(e) => setCsvTargetBatchId(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">CSV File Upload or Paste Text</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="text-xs text-surface-500 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Name, Phone, Batch\nHamza Tariq, 03001234567, Class 9\nSara Ahmed, 03217654321, Class 10`}
                  className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[11px] text-surface-400 mt-1">
                  Format: <strong>Name, Phone</strong> or <strong>Name, Phone, Batch</strong> — one
                  student per line. A header row is skipped. If the batch column is missing or has
                  an unknown name, the selected batch above is used.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCsvModal(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  loading={importingCsv}
                  onClick={handleImportCsv}
                >
                  Import Students
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
