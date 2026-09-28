// ============================================
// TUITION PANEL - Database Type Definitions
// Matches the InsForge PostgreSQL schema plus
// migrations/001_accounts_pin_and_rls.sql
// ============================================

export type ThemePreference = 'light' | 'dark' | 'system';
export type AttendanceStatus = 'P' | 'A' | 'L';
export type FineType = 'auto' | 'custom';
export type FineStatus = 'pending' | 'paid' | 'cancelled';

// ---- Teachers ----
export interface Teacher {
  id: string;
  name: string;
  created_at: string;
  theme_preference: ThemePreference;
  custom_color_settings: Record<string, string> | null;
  /** Auth account this profile belongs to. NULL for legacy/unclaimed rows. */
  user_id: string | null;
  /** Platform administrator flag. */
  is_admin: boolean;
  /** PBKDF2 digest of the 6-digit PIN. The PIN itself is never stored. */
  pin_hash: string | null;
  pin_salt: string | null;
  pin_iterations: number | null;
  pin_set_at: string | null;
}

// ---- Settings ----
export interface Settings {
  id: string;
  teacher_id: string | null; // null = global defaults
  min_attendance_percent: number;
  fine_amount: number;
  max_allowed_leaves: number;
  app_primary_color: string | null;
  app_secondary_color: string | null;
}

// ---- Batches ----
export interface Batch {
  id: string;
  teacher_id: string;
  name: string;
  created_at: string;
  /** Soft-delete flag (see migration 001). */
  is_deleted: boolean;
  deleted_at: string | null;
}

// ---- Students ----
export interface Student {
  id: string;
  batch_id: string;
  name: string;
  phone: string;
  created_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

// ---- Holidays ----
export interface Holiday {
  id: string;
  teacher_id: string;
  date: string;
  label: string;
  created_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

// ---- Attendance ----
export interface Attendance {
  id: string;
  student_id: string;
  month: string; // YYYY-MM format
  day_number: number; // 1-31
  status: AttendanceStatus;
  marked_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

// ---- Fines ----
export interface Fine {
  id: string;
  student_id: string;
  month: string; // YYYY-MM format
  amount: number;
  label: string;
  type: FineType;
  status: FineStatus;
  payment_date: string | null;
  created_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

// ---- Activity Log ----
export interface ActivityLog {
  id: string;
  teacher_name: string;
  action: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}
