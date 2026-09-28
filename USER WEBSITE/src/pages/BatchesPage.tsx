// ============================================
// Batches Management Page
// Add/Edit/Delete tuition batches for active teacher
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Users, AlertCircle } from 'lucide-react';
import { Card, Input, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService } from '../services/db';
import type { Batch, Student } from '../types/database';

export default function BatchesPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBatchName, setNewBatchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    } catch (err) {
      console.warn('Load batches error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) {
      showToast('Please enter a batch name', 'error');
      return;
    }
    if (!currentTeacher) {
      showToast('Please select a teacher profile first', 'error');
      return;
    }

    setCreating(true);
    try {
      await dbService.createBatch(newBatchName.trim(), currentTeacher.id);
      showToast(`Batch "${newBatchName.trim()}" created successfully!`, 'success');
      setNewBatchName('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create batch';
      showToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    const studentCount = students.filter((s) => s.batch_id === batchId).length;
    // Deleting a batch now ARCHIVES it (and its students, attendance and fines)
    // so everything can be restored from the Recycle Bin.
    const message =
      studentCount > 0
        ? `Move batch "${batchName}" and its ${studentCount} student(s) to the Recycle Bin?\n\nTheir attendance and fines are archived too, and you can restore everything within 30 days.`
        : `Move batch "${batchName}" to the Recycle Bin?\n\nYou can restore it within 30 days.`;
    if (!window.confirm(message)) return;

    setDeletingId(batchId);
    try {
      await dbService.deleteBatch(batchId);
      showToast(`Batch "${batchName}" moved to Recycle Bin`, 'success');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete batch';
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!currentTeacher) {
    return (
      <div className="p-8 text-center glass-card max-w-lg mx-auto my-12 animate-fade-in">
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
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white shadow-glow">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="page-title">{t('batch.title')}</h1>
              <p className="page-subtitle">
                {currentTeacher.name} • {batches.length} {t('nav.batches')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Batch Form */}
      <Card>
        <form onSubmit={handleCreateBatch} className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1 w-full">
            <Input
              label={t('batch.batch_name')}
              placeholder="e.g. Class 9 - Physics, Matric Evening, Cambridge O-Levels"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Plus size={16} />}
            loading={creating}
            className="w-full sm:w-auto"
          >
            {t('common.add')}
          </Button>
        </form>
      </Card>

      {/* Batches Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : batches.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300">
            {t('common.empty')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            Create your first tuition batch above to start adding students.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => {
            const count = students.filter((s) => s.batch_id === batch.id).length;
            return (
              <Card
                key={batch.id}
                className="relative group hover:border-primary-400/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-base text-surface-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {batch.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400 mt-2">
                      <Users size={14} />
                      <span>{count} {t('batch.student_count')}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteBatch(batch.id, batch.name)}
                    disabled={deletingId === batch.id}
                    className="p-2 rounded-xl text-surface-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
