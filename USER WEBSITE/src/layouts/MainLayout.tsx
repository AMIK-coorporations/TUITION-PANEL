// ============================================
// MainLayout - Minimal Responsive Layout
// Desktop Left Sidebar + Mobile Bottom Navigation Bar + Header Controls
// Supports English, LTR Urdu, and RTL Urdu
// ============================================

import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Users,
  BookOpen,
  CalendarOff,
  Receipt,
  FileText,
  Settings,
  Trash2,
  Shield,
  Menu,
  X,
  Moon,
  Sun,
  Globe,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTeacher } from '../context/TeacherContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isAdminCodeValid } from '../lib/secrets';
import BrandLogo from '../components/BrandLogo';

export default function MainLayout() {
  const { t, language, setLanguage } = useLanguage();
  const { currentTeacher } = useTeacher();
  const { email, signOut, profile } = useAuth();
  // Theme comes from the app-level provider so /4321 stays in sync.
  const { isDark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close the dropdowns on outside click or Escape so they cannot get stuck open.
  useEffect(() => {
    if (!langDropdownOpen && !accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      setLangDropdownOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangDropdownOpen(false);
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [langDropdownOpen, accountMenuOpen]);

  const navItems = [
    { name: t('nav.dashboard'), href: '/', icon: BarChart3 },
    { name: t('nav.attendance'), href: '/attendance', icon: CalendarDays },
    { name: t('nav.students'), href: '/students', icon: Users },
    { name: t('nav.batches'), href: '/batches', icon: BookOpen },
    { name: t('nav.holidays'), href: '/holidays', icon: CalendarOff },
    { name: t('nav.fines'), href: '/fines', icon: Receipt },
    { name: t('nav.reports'), href: '/reports', icon: FileText },
    { name: t('nav.recycle_bin'), href: '/recycle-bin', icon: Trash2 },
    { name: t('nav.settings'), href: '/settings', icon: Settings },
  ];

  const displayName = currentTeacher?.name || profile?.name || 'Teacher';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'T';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 transition-colors">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop & Tablet Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? '' : 'sidebar-hidden'} lg:!transform-none transition-transform duration-200 ease-in-out`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 h-[var(--header-height)] border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 shadow-glow p-1" alt="TUITION PANEL logo" />
            <div>
              <span className="font-bold text-sm tracking-tight block">
                TUITION PANEL
              </span>
              <span className="text-[10px] text-surface-400 font-mono">
                v1.0.0
              </span>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-surface-400 hover:text-surface-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ltr:ml-[var(--sidebar-width)] lg:rtl:mr-[var(--sidebar-width)] pb-16 lg:pb-0">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 h-[var(--header-height)] flex items-center justify-between px-4 sm:px-8 bg-white/80 dark:bg-surface-900/80 backdrop-blur-md border-b border-surface-200 dark:border-surface-800">
          {/* Left: Mobile hamburger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
              onClick={() => setSidebarOpen(true)}
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>

            {/* Current Account Menu (replaces the old teacher picker) */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen((v) => !v);
                  setLangDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-xs"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold">
                  {initial}
                </span>
                <span className="font-semibold text-surface-800 dark:text-surface-200 max-w-[110px] truncate">
                  {displayName}
                </span>
                <ChevronDown size={12} className="text-surface-400" />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-0 rtl:left-auto rtl:right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-glass-lg p-1.5 z-50 animate-scale-in text-xs"
                >
                  <div className="px-3 py-2.5 border-b border-surface-200 dark:border-surface-700 mb-1">
                    <p className="font-semibold text-surface-800 dark:text-surface-100 truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-surface-400 truncate mt-0.5">
                      {email || 'Signed in'}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left rtl:text-right px-3 py-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                  >
                    <UserIcon size={14} className="text-surface-400" />
                    Profile &amp; PIN
                  </button>

                  {/* The Super Admin panel is reachable from here; it still
                      demands the admin access code on /4321. */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      const code = window.prompt('Enter admin access code');
                      if (code && isAdminCodeValid(code)) {
                        navigate('/4321');
                      } else if (code) {
                        window.alert('Incorrect admin code.');
                      }
                    }}
                    className="w-full text-left rtl:text-right px-3 py-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                  >
                    <Shield size={14} className="text-amber-500" />
                    Super Admin Panel
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void signOut();
                    }}
                    className="w-full text-left rtl:text-right px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Language Switcher & Dark Mode Toggle */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-xs font-semibold"
              >
                <Globe size={14} className="text-indigo-500" />
                <span className="hidden sm:inline">
                  {language === 'ur-ltr'
                    ? 'اردو (LTR)'
                    : language === 'ur-rtl'
                    ? 'اردو (RTL)'
                    : 'English'}
                </span>
                <ChevronDown size={12} className="text-surface-400" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-glass-lg p-1.5 z-50 animate-scale-in text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('ur-ltr');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl flex items-center justify-between ${
                      language === 'ur-ltr'
                        ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 font-bold'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-700'
                    }`}
                  >
                    <span>اردو (بائیں سے دائیں)</span>
                    {language === 'ur-ltr' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('ur-rtl');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl flex items-center justify-between ${
                      language === 'ur-rtl'
                        ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 font-bold'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-700'
                    }`}
                  >
                    <span>اردو (دائیں سے بائیں)</span>
                    {language === 'ur-rtl' && <span>✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left rtl:text-right px-3 py-2 rounded-xl flex items-center justify-between ${
                      language === 'en'
                        ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 font-bold'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-700'
                    }`}
                  >
                    <span>English (🔒)</span>
                    {language === 'en' && <span>✓</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 transition-colors"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Mobile-first excellence) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 dark:bg-surface-900/95 backdrop-blur-md border-t border-surface-200 dark:border-surface-800 flex items-center justify-around py-2 px-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600 font-bold' : 'text-surface-400'
            }`
          }
        >
          <BarChart3 size={18} />
          <span>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600 font-bold' : 'text-surface-400'
            }`
          }
        >
          <CalendarDays size={18} />
          <span>{t('nav.attendance')}</span>
        </NavLink>
        <NavLink
          to="/students"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600 font-bold' : 'text-surface-400'
            }`
          }
        >
          <Users size={18} />
          <span>{t('nav.students')}</span>
        </NavLink>
        <NavLink
          to="/fines"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600 font-bold' : 'text-surface-400'
            }`
          }
        >
          <Receipt size={18} />
          <span>{t('nav.fines')}</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600 font-bold' : 'text-surface-400'
            }`
          }
        >
          <Settings size={18} />
          <span>{t('nav.settings')}</span>
        </NavLink>
      </nav>
    </div>
  );
}
