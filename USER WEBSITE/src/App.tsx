// ============================================
// App.tsx - Application Core Router
// Provider order: Toast -> Theme -> Language -> Auth -> Teacher -> Routes
//
// The Super Admin panel (/4321) is intentionally OUTSIDE the teacher AuthGuard:
// it opens with just the 654321 code - no sign in/up, no PIN, and a reload
// never bounces to the teacher login screens.
// The main teacher app stays behind AuthGuard (account sign-in + PIN).
// ============================================

import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { TeacherProvider } from './context/TeacherContext';
import AuthGuard from './components/auth/AuthGuard';
import BrandLogo from './components/BrandLogo';

import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import StudentsPage from './pages/StudentsPage';
import BatchesPage from './pages/BatchesPage';
import HolidaysPage from './pages/HolidaysPage';
import FinesPage from './pages/FinesPage';
import ReportsPage from './pages/ReportsPage';
import RecycleBinPage from './pages/RecycleBinPage';
import SettingsPage from './pages/SettingsPage';

// The admin panel is only reached through the secret /4321 URL, so load it on
// demand rather than shipping it in the main bundle.
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-surface-400">
      <BrandLogo className="w-14 h-14 rounded-2xl bg-white shadow ring-1 ring-black/5 p-1.5" />
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <TeacherProvider>
              <Routes>
                {/*
                  Super Admin: /4321 is intentionally OUTSIDE AuthGuard.
                  Its own 654321 gate is the only check, exactly as requested.
                */}
                <Route
                  path="/4321"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <SuperAdminPage />
                    </Suspense>
                  }
                />

                {/* Main teacher application: gated by account sign-in + PIN. */}
                <Route
                  element={
                    <AuthGuard>
                      <MainLayout />
                    </AuthGuard>
                  }
                >
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/batches" element={<BatchesPage />} />
                  <Route path="/holidays" element={<HolidaysPage />} />
                  <Route path="/fines" element={<FinesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/recycle-bin" element={<RecycleBinPage />} />
                  <Route path="/settings" element={<SettingsPage />} />

                  {/* Catch-all: redirect instead of rendering a blank page */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </TeacherProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}