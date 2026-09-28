// ============================================
// useSettings Hook - CRUD for teacher settings
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { insforge } from '../lib/insforge';
import type { Settings } from '../types/database';

type SettingsValues = Partial<Settings>;

type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface PendingSettingsSave {
  values: SettingsValues;
  teacherId: string | null;
}

interface UseSettingsReturn {
  settings: Partial<Settings> | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  validationError: string | null;
  dirty: boolean;
  autoSaveStatus: AutoSaveStatus;
  loadSettings: (teacherId?: string) => Promise<void>;
  saveSettings: (values: SettingsValues, teacherId?: string) => Promise<boolean>;
  scheduleSave: (values: SettingsValues, teacherId?: string) => boolean;
  flushSave: () => Promise<boolean>;
  cancelSave: () => boolean;
}

const DEFAULTS: Partial<Settings> = {
  min_attendance_percent: 70,
  fine_amount: 500,
  max_allowed_leaves: 4,
  app_primary_color: '#6366f1',
  app_secondary_color: '#10b981',
};

const validateSettingsValues = (values: SettingsValues): string | null => {
  const attendance = Number(values.min_attendance_percent ?? DEFAULTS.min_attendance_percent);
  const fine = Number(values.fine_amount ?? DEFAULTS.fine_amount);
  const leaves = Number(values.max_allowed_leaves ?? DEFAULTS.max_allowed_leaves);

  if (isNaN(attendance) || attendance < 0 || attendance > 100) {
    return 'Attendance percentage must be between 0 and 100';
  }

  if (isNaN(fine) || fine < 0) {
    return 'Fine amount must be a non-negative number';
  }

  if (isNaN(leaves) || leaves < 0 || leaves > 31) {
    return 'Maximum leaves must be between 0 and 31';
  }

  return null;
};

export function useSettings(teacherId?: string): UseSettingsReturn {
  const [settings, setSettings] = useState<Partial<Settings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');

  // True only while the component is actually mounted. Guards every setState
  // below so a late-resolving request cannot write to an unmounted component.
  const mountedRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const saveSequenceRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<PendingSettingsSave | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  const loadSettings = useCallback(async (tid?: string) => {
    const requestId = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    setValidationError(null);
    setSettings(null);

    try {
      const targetTeacherId = tid ?? teacherId ?? null;
      let loadedSettings: Partial<Settings> | null = null;

      if (targetTeacherId) {
        const { data, error: fetchError } = await insforge.database
          .from('settings')
          .select('*')
          .eq('teacher_id', targetTeacherId);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          loadedSettings = data[0] as Settings;
        }
      }

      if (!loadedSettings) {
        const { data: globalData, error: globalError } = await insforge.database
          .from('settings')
          .select('*')
          .is('teacher_id', null);

        if (globalError) throw globalError;

        loadedSettings =
          globalData && globalData.length > 0 ? (globalData[0] as Settings) : DEFAULTS;
      }

      if (!mountedRef.current || requestId !== loadSequenceRef.current) return;

      setSettings(loadedSettings);
      setDirty(false);
      setAutoSaveStatus('idle');
    } catch (err: unknown) {
      if (!mountedRef.current || requestId !== loadSequenceRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      setSettings(DEFAULTS);
      setDirty(false);
      setAutoSaveStatus('error');
    } finally {
      if (mountedRef.current && requestId === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [teacherId]);

  const runSave = useCallback(
    async (values: SettingsValues, tid?: string): Promise<boolean> => {
      const requestId = ++saveSequenceRef.current;
      const targetTeacherId = tid ?? teacherId ?? null;
      const validationMessage = validateSettingsValues(values);

      if (validationMessage) {
        if (mountedRef.current && requestId === saveSequenceRef.current) {
          setValidationError(validationMessage);
          setError(validationMessage);
          setAutoSaveStatus('error');
        }
        return false;
      }

      if (mountedRef.current) {
        setSaving(true);
        setError(null);
        setValidationError(null);
        setAutoSaveStatus('saving');
      }

      try {
        if (requestId !== saveSequenceRef.current) return false;

        const existingQuery = targetTeacherId
          ? insforge.database
              .from('settings')
              .select('id')
              .eq('teacher_id', targetTeacherId)
          : insforge.database
              .from('settings')
              .select('id')
              .is('teacher_id', null);

        const { data: existing, error: fetchError } = await existingQuery;
        if (fetchError) throw fetchError;
        if (requestId !== saveSequenceRef.current) return false;

        let saved: Partial<Settings> | null = null;

        if (existing && existing.length > 0) {
          const { data, error: updateError } = await insforge.database
            .from('settings')
            .update({
              teacher_id: targetTeacherId,
              min_attendance_percent:
                values.min_attendance_percent ?? DEFAULTS.min_attendance_percent,
              fine_amount: values.fine_amount ?? DEFAULTS.fine_amount,
              max_allowed_leaves:
                values.max_allowed_leaves ?? DEFAULTS.max_allowed_leaves,
              app_primary_color: values.app_primary_color ?? DEFAULTS.app_primary_color,
              app_secondary_color:
                values.app_secondary_color ?? DEFAULTS.app_secondary_color,
            })
            .eq('id', (existing[0] as { id: string }).id)
            .select();

          if (updateError) throw updateError;
          saved = data?.[0] ?? {
            ...DEFAULTS,
            ...values,
            teacher_id: targetTeacherId,
          };
        } else {
          const { data, error: insertError } = await insforge.database
            .from('settings')
            .insert([
              {
                teacher_id: targetTeacherId,
                min_attendance_percent:
                  values.min_attendance_percent ?? DEFAULTS.min_attendance_percent,
                fine_amount: values.fine_amount ?? DEFAULTS.fine_amount,
                max_allowed_leaves:
                  values.max_allowed_leaves ?? DEFAULTS.max_allowed_leaves,
                app_primary_color: values.app_primary_color ?? DEFAULTS.app_primary_color,
                app_secondary_color:
                  values.app_secondary_color ?? DEFAULTS.app_secondary_color,
              },
            ])
            .select();

          if (insertError) throw insertError;
          saved = data?.[0] ?? {
            ...DEFAULTS,
            ...values,
            teacher_id: targetTeacherId,
          };
        }

        if (requestId !== saveSequenceRef.current) return false;

        setSettings(saved);
        setDirty(false);
        setAutoSaveStatus('saved');
        return true;
      } catch (err: unknown) {
        if (requestId !== saveSequenceRef.current) return false;

        const message = err instanceof Error ? err.message : 'Failed to save settings';
        setError(message);
        setValidationError(null);
        setAutoSaveStatus('error');
        return false;
      } finally {
        if (mountedRef.current && requestId === saveSequenceRef.current) {
          setSaving(false);
        }
      }
    },
    [teacherId],
  );

  const saveSettings = useCallback(
    async (values: SettingsValues, tid?: string): Promise<boolean> => {
      const promise = runSave(values, tid);
      savePromiseRef.current = promise;

      try {
        return await promise;
      } finally {
        if (savePromiseRef.current === promise) {
          savePromiseRef.current = null;
        }
      }
    },
    [runSave],
  );

  const scheduleSave = useCallback(
    (values: SettingsValues, tid?: string): boolean => {
      const validationMessage = validateSettingsValues(values);

      if (validationMessage) {
        if (mountedRef.current) {
          setValidationError(validationMessage);
          setError(validationMessage);
          setAutoSaveStatus('error');
          setDirty(true);
        }
        return false;
      }

      if (mountedRef.current) {
        setError(null);
        setValidationError(null);
        setDirty(true);
        setAutoSaveStatus('pending');
      }

      const targetTeacherId = tid ?? teacherId ?? null;
      pendingSaveRef.current = { values, teacherId: targetTeacherId };

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;

        if (pending) {
          void saveSettings(pending.values, pending.teacherId ?? undefined);
        }
      }, 1000);

      return true;
    },
    [saveSettings, teacherId],
  );

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (savePromiseRef.current) {
      await savePromiseRef.current;
    }

    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;

    if (!pending) {
      if (mountedRef.current) {
        setAutoSaveStatus('idle');
      }
      return true;
    }

    return saveSettings(pending.values, pending.teacherId ?? undefined);
  }, [saveSettings]);

  const cancelSave = useCallback((): boolean => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    pendingSaveRef.current = null;

    if (mountedRef.current) {
      setDirty(false);
      setAutoSaveStatus('idle');
      setValidationError(null);
      setError(null);
    }

    return true;
  }, []);

  // Always points at the newest saveSettings, so the unmount cleanup below can
  // flush a pending edit without this effect re-running (and briefly clearing
  // mountedRef) every time `teacherId` changes.
  const saveSettingsRef = useRef(saveSettings);
  useEffect(() => {
    saveSettingsRef.current = saveSettings;
  }, [saveSettings]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;

      if (pending) {
        // Best-effort flush of an unsaved edit when navigating away.
        void saveSettingsRef.current(pending.values, pending.teacherId ?? undefined);
      }
    };
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saving,
    error,
    validationError,
    dirty,
    autoSaveStatus,
    loadSettings,
    saveSettings,
    scheduleSave,
    flushSave,
    cancelSave,
  };
}
