// ============================================
// Holiday Management Page
// Calendar/List view to mark holidays excluded from attendance
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarOff, Plus, Trash2, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { Card, Input, Button, Spinner } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useTeacher } from '../context/TeacherContext';
import { useLanguage } from '../context/LanguageContext';
import { dbService } from '../services/db';
import type { Holiday } from '../types/database';

export default function HolidaysPage() {
  const { currentTeacher } = useTeacher();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadHolidays = useCallback(async () => {
    if (!currentTeacher) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await dbService.getHolidays(currentTeacher.id);
      setHolidays(data);
    } catch (err) {
      console.warn('Holidays load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeacher]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newLabel.trim()) {
      showToast('Please specify a date and holiday label', 'error');
      return;
    }
    if (!currentTeacher) return;

    setSaving(true);
    try {
      await dbService.createHoliday(newDate, newLabel.trim(), currentTeacher.id);
      showToast(`Holiday "${newLabel.trim()}" added!`, 'success');
      setNewLabel('');
      await loadHolidays();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add holiday';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string, label: string) => {
    const ok = window.confirm(`Move holiday "${label}" to Recycle Bin?`);
    if (!ok) return;

    try {
      await dbService.softDeleteHoliday(id);
      showToast('Holiday moved to Recycle Bin', 'info');
      await loadHolidays();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      showToast(msg, 'error');
    }
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-glow">
            <CalendarOff size={20} />
          </div>
          <div>
            <h1 className="page-title">{t('holiday.title')}</h1>
            <p className="page-subtitle">
              {currentTeacher.name} • {holidays.length} {t('nav.holidays')}
            </p>
          </div>
        </div>
      </div>

      {/* Excluded Note */}
      <div className="p-4 rounded-2xl bg-primary-50/60 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/40 text-xs text-primary-800 dark:text-primary-300 flex items-center gap-2.5">
        <CalendarIcon size={16} className="shrink-0" />
        <span>💡 {t('holiday.excluded_note')}</span>
      </div>

      {/* Add Holiday Card */}
      <Card>
        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <Input
              label={t('common.date')}
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-6">
            <Input
              label={t('holiday.label')}
              placeholder="e.g. Eid-ul-Fitr, Heavy Rain, Independence Day"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="primary"
              icon={<Plus size={16} />}
              loading={saving}
              className="w-full"
            >
              {t('common.add')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Holidays List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : holidays.length === 0 ? (
        <Card className="text-center py-16">
          <CalendarOff size={48} className="mx-auto text-surface-300 dark:text-surface-600 mb-3" />
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300">
            {t('common.empty')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            No holidays registered yet. Add official or tuition days off above.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {holidays.map((holiday) => (
            <Card
              key={holiday.id}
              className="flex items-center justify-between p-4 hover:border-primary-400/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex flex-col items-center justify-center font-mono text-xs text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                  <span className="text-[9px] uppercase tracking-wider text-surface-400">
                    {new Date(holiday.date).toLocaleString('default', { month: 'short' })}
                  </span>
                  <span className="font-bold text-sm">
                    {holiday.date.split('-')[2]}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-surface-900 dark:text-white">
                    {holiday.label}
                  </h4>
                  <p className="text-xs text-surface-400 font-mono mt-0.5">
                    {holiday.date}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteHoliday(holiday.id, holiday.label)}
                className="p-1.5 text-surface-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title={t('common.delete')}
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
