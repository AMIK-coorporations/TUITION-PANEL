// ============================================
// Teacher Context
//
// The teacher identity now comes from the signed-in ACCOUNT, not from a
// "Who are you?" picker. The picker has been removed.
//
// This provider is kept as a thin adapter over AuthContext so the existing
// pages that read `currentTeacher` keep working unchanged.
// ============================================

import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import type { Teacher } from '../types/database';

interface TeacherContextType {
  currentTeacher: Teacher | null;
  teachers: Teacher[];
  loadingTeachers: boolean;
  /** @deprecated The teacher picker was removed. Retained for compatibility. */
  selectTeacher: (teacher: Teacher | null) => void;
  refreshTeachers: () => Promise<void>;
  /** @deprecated The onboarding picker no longer exists. */
  showOnboarding: boolean;
  /** @deprecated The onboarding picker no longer exists. */
  setShowOnboarding: (show: boolean) => void;
}

const TeacherContext = createContext<TeacherContextType | null>(null);

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { profile, status, initializing, refreshProfile } = useAuth();

  const value = useMemo<TeacherContextType>(
    () => ({
      currentTeacher: profile,
      teachers: profile ? [profile] : [],
      loadingTeachers: initializing || status === 'loading',
      selectTeacher: (teacher: Teacher | null) => {
        // No-op: identity is derived from the authenticated account.
        if (teacher) {
          console.warn(
            'selectTeacher() is deprecated. Teacher identity now comes from the signed-in account.'
          );
        }
      },
      refreshTeachers: refreshProfile,
      showOnboarding: false,
      setShowOnboarding: () => {
        // No-op: there is no teacher picker any more.
      },
    }),
    [profile, status, initializing, refreshProfile]
  );

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>;
}

export function useTeacher() {
  const context = useContext(TeacherContext);
  if (!context) {
    throw new Error('useTeacher must be used within a TeacherProvider');
  }
  return context;
}