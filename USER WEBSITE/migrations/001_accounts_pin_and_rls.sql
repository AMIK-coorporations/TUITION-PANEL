-- ============================================================================
-- TUITION PANEL - Migration 001
-- Accounts, 6-digit security PIN, teacher<->account linking, optional RLS
-- Target: InsForge (PostgreSQL + PostgREST)
-- ----------------------------------------------------------------------------
-- HOW TO RUN
--   1. Run PART 1 and PART 2. Both are additive and safe for existing data.
--   2. Deploy the app, create an account, confirm sign-in + PIN work.
--   3. Only then consider PART 3. Read its warning block first.
--
--   PART 1  schema additions ............... safe, additive, no data loss
--   PART 2  helper functions ............... safe, additive
--   PART 3  row level security ............. CHANGES ACCESS RULES - read first
--   PART 4  rollback / cleanup ............. manual, only if you need it
--
-- NOTE ON EXISTING DEMO DATA
--   Existing rows in `teachers` have user_id = NULL, so they are "unclaimed".
--   They become legacy rows. A new account creates its own teacher profile on
--   first sign-up. Use PART 4 if you want to adopt an existing row by email.
-- ============================================================================


-- ============================================================================
-- PART 1 - Schema additions (safe, additive)
-- ============================================================================

-- Links a teacher profile row to exactly one InsForge auth account.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id UUID;

-- Marks an account as a platform administrator.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 6-digit PIN ("passkey") storage.
-- Only a PBKDF2-SHA256 digest is stored. The PIN itself is NEVER written to
-- the database, and no plaintext PIN is recoverable from these columns.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pin_salt TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pin_iterations INTEGER;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ;

-- Batch soft-delete. Deleting a batch used to HARD-delete it, which cascaded
-- into students, attendance and fines and destroyed history with no recovery.
-- Batches now soft-delete like everything else so the Recycle Bin can restore
-- a whole class (see dbService.deleteBatch / restoreBatch).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- One teacher profile per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_user_id
    ON teachers(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_batches_is_deleted ON batches(is_deleted);

-- Fast admin lookups.
CREATE INDEX IF NOT EXISTS idx_teachers_is_admin ON teachers(is_admin);

-- Scoping indexes so per-teacher filtering does not need a full table scan.
CREATE INDEX IF NOT EXISTS idx_fines_is_deleted       ON fines(is_deleted);
CREATE INDEX IF NOT EXISTS idx_holidays_is_deleted    ON holidays(is_deleted);
CREATE INDEX IF NOT EXISTS idx_attendance_is_deleted  ON attendance(is_deleted);


-- ============================================================================
-- PART 2 - Helper functions (safe, additive)
-- ============================================================================

-- Returns the teacher profile id belonging to the caller's auth account.
-- SECURITY DEFINER so it can read `teachers` even when the caller's own RLS
-- policy would otherwise hide the row.
CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM public.teachers
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- True when the caller's account is flagged as an administrator.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT t.is_admin FROM public.teachers t WHERE t.user_id = auth.uid() LIMIT 1),
        false
    );
$$;


-- ============================================================================
-- PART 3 - Row Level Security  *** READ BEFORE RUNNING ***
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   Replaces the current "allow absolutely everyone everything" policies with
--   per-teacher isolation: a signed-in teacher can only reach their own
--   batches, students, attendance, fines, holidays and settings.
--
-- WHY IT IS OPTIONAL / LAST
--   Your /4321 Super Admin panel currently authenticates with the shared code
--   654321 and NO account. That is an anonymous caller. Once RLS is enforced
--   with the policies below, the anonymous admin panel can no longer read or
--   write platform-wide data, because there is no identity to grant access to.
--
--   You therefore have two options:
--
--   OPTION A (recommended, most secure)
--     Create a real account for yourself, then flag it as admin:
--         UPDATE teachers SET is_admin = TRUE WHERE user_id = '<your-auth-user-id>';
--     The admin policies at the bottom of this file then work correctly, and
--     654321 becomes a second gate on top of a real login.
--
--   OPTION B (keep 654321-only admin, weaker)
--     Do NOT run PART 3. Per-teacher isolation is then not enforced at the
--     database, so any holder of the public anon key can still read everything.
--
-- BEFORE YOU RUN THIS
--   * Confirm `auth.uid()` exists in your InsForge database. If your project
--     exposes it under a different name, replace every `auth.uid()` below.
--     Verify with:  SELECT auth.uid();
--   * Take a backup first (the admin panel has "Export Backup").
--
-- ROLLBACK is in PART 4.
-- ----------------------------------------------------------------------------

-- Drop the old permissive policies.
DROP POLICY IF EXISTS "Allow public all on teachers"     ON teachers;
DROP POLICY IF EXISTS "Allow public all on settings"     ON settings;
DROP POLICY IF EXISTS "Allow public all on batches"      ON batches;
DROP POLICY IF EXISTS "Allow public all on students"     ON students;
DROP POLICY IF EXISTS "Allow public all on holidays"     ON holidays;
DROP POLICY IF EXISTS "Allow public all on attendance"   ON attendance;
DROP POLICY IF EXISTS "Allow public all on fines"        ON fines;
DROP POLICY IF EXISTS "Allow public all on activity_log" ON activity_log;

-- Make sure RLS is actually switched on.
ALTER TABLE teachers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ---- teachers ------------------------------------------------------------
-- A teacher reads/updates only their own row; admins see everything.
-- An authenticated user may create their own profile row (first sign-up).
DROP POLICY IF EXISTS teachers_select_own ON teachers;
CREATE POLICY teachers_select_own ON teachers
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS teachers_insert_own ON teachers;
CREATE POLICY teachers_insert_own ON teachers
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS teachers_update_own ON teachers;
CREATE POLICY teachers_update_own ON teachers
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_platform_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS teachers_delete_admin ON teachers;
CREATE POLICY teachers_delete_admin ON teachers
    FOR DELETE TO authenticated
    USING (public.is_platform_admin());

-- ---- settings ------------------------------------------------------------
-- A teacher can manage their OWN settings row (teacher_id = their profile).
DROP POLICY IF EXISTS settings_owner_all ON settings;
CREATE POLICY settings_owner_all ON settings
    FOR ALL TO authenticated
    USING (teacher_id = public.current_teacher_id() OR public.is_platform_admin())
    WITH CHECK (teacher_id = public.current_teacher_id() OR public.is_platform_admin());

-- The GLOBAL defaults row has teacher_id IS NULL, which the policy above does
-- not match. Without this, every teacher would lose their fallback defaults
-- (the app would silently fall back to hardcoded 70 / 500 / 4).
-- Read-only for everyone signed in; only admins may change it.
DROP POLICY IF EXISTS settings_global_read ON settings;
CREATE POLICY settings_global_read ON settings
    FOR SELECT TO authenticated
    USING (teacher_id IS NULL);

DROP POLICY IF EXISTS settings_global_admin_write ON settings;
CREATE POLICY settings_global_admin_write ON settings
    FOR ALL TO authenticated
    USING (teacher_id IS NULL AND public.is_platform_admin())
    WITH CHECK (teacher_id IS NULL AND public.is_platform_admin());

-- ---- batches -------------------------------------------------------------
DROP POLICY IF EXISTS batches_owner_all ON batches;
CREATE POLICY batches_owner_all ON batches
    FOR ALL TO authenticated
    USING (teacher_id = public.current_teacher_id() OR public.is_platform_admin())
    WITH CHECK (teacher_id = public.current_teacher_id() OR public.is_platform_admin());

-- ---- students (owned via their batch) -----------------------------------
DROP POLICY IF EXISTS students_owner_all ON students;
CREATE POLICY students_owner_all ON students
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR batch_id IN (
            SELECT b.id FROM batches b WHERE b.teacher_id = public.current_teacher_id()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR batch_id IN (
            SELECT b.id FROM batches b WHERE b.teacher_id = public.current_teacher_id()
        )
    );

-- ---- holidays ------------------------------------------------------------
DROP POLICY IF EXISTS holidays_owner_all ON holidays;
CREATE POLICY holidays_owner_all ON holidays
    FOR ALL TO authenticated
    USING (teacher_id = public.current_teacher_id() OR public.is_platform_admin())
    WITH CHECK (teacher_id = public.current_teacher_id() OR public.is_platform_admin());

-- ---- attendance (owned via student -> batch) ----------------------------
DROP POLICY IF EXISTS attendance_owner_all ON attendance;
CREATE POLICY attendance_owner_all ON attendance
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR student_id IN (
            SELECT s.id FROM students s
            JOIN batches b ON b.id = s.batch_id
            WHERE b.teacher_id = public.current_teacher_id()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR student_id IN (
            SELECT s.id FROM students s
            JOIN batches b ON b.id = s.batch_id
            WHERE b.teacher_id = public.current_teacher_id()
        )
    );

-- ---- fines (owned via student -> batch) ---------------------------------
DROP POLICY IF EXISTS fines_owner_all ON fines;
CREATE POLICY fines_owner_all ON fines
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR student_id IN (
            SELECT s.id FROM students s
            JOIN batches b ON b.id = s.batch_id
            WHERE b.teacher_id = public.current_teacher_id()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR student_id IN (
            SELECT s.id FROM students s
            JOIN batches b ON b.id = s.batch_id
            WHERE b.teacher_id = public.current_teacher_id()
        )
    );

-- ---- activity_log --------------------------------------------------------
-- Append-only for teachers; readable only by admins (it is a security log).
DROP POLICY IF EXISTS activity_log_insert ON activity_log;
CREATE POLICY activity_log_insert ON activity_log
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS activity_log_admin_read ON activity_log;
CREATE POLICY activity_log_admin_read ON activity_log
    FOR SELECT TO authenticated
    USING (public.is_platform_admin());

-- ---- admin platform-wide reads -------------------------------------------
-- is_platform_admin() already covers most tables through the OR clauses above.
-- These two are called out because the Super Admin "Database Stats" and
-- "Global Recycle Bin" tabs read every row, and NOT NULL / renamed columns
-- previously made them fail silently.
--
-- Verify the helper resolves for YOUR account before relying on it:
--     SELECT public.is_platform_admin();
-- It must return true. If it returns false, run:
--     UPDATE teachers SET is_admin = TRUE WHERE user_id = auth.uid();
--
-- IF YOUR PROJECT DOES NOT EXPOSE auth.uid()
--   Both helper functions (PART 2) return NULL/false, and every policy above
--   denies access. Confirm with:  SELECT auth.uid();
--   If that errors, replace every `auth.uid()` in this file with the correct
--   expression for your InsForge version before running PART 3.


-- ============================================================================
-- PART 4 - Optional helpers
-- ============================================================================

-- Adopt a legacy teacher row into your own new account by teacher name.
-- Replace both values, then run.
--
-- UPDATE teachers
--    SET user_id = '<your-auth-user-id>'
--  WHERE id = '<legacy-teacher-row-id>'
--    AND user_id IS NULL;

-- Make yourself an admin.
-- UPDATE teachers SET is_admin = TRUE WHERE user_id = '<your-auth-user-id>';

-- See which teacher rows are still unclaimed.
-- SELECT id, name, is_admin FROM teachers WHERE user_id IS NULL ORDER BY name;

-- FULL ROLLBACK of PART 3 (restores the original open policies).
-- Only run this if RLS locks you out and you need the app working again.
--
-- DROP POLICY IF EXISTS teachers_select_own    ON teachers;
-- DROP POLICY IF EXISTS teachers_insert_own    ON teachers;
-- DROP POLICY IF EXISTS teachers_update_own    ON teachers;
-- DROP POLICY IF EXISTS teachers_delete_admin  ON teachers;
-- DROP POLICY IF EXISTS settings_owner_all     ON settings;
-- DROP POLICY IF EXISTS settings_global_read   ON settings;
-- DROP POLICY IF EXISTS settings_global_admin_write ON settings;
-- DROP POLICY IF EXISTS batches_owner_all      ON batches;
-- DROP POLICY IF EXISTS students_owner_all     ON students;
-- DROP POLICY IF EXISTS holidays_owner_all     ON holidays;
-- DROP POLICY IF EXISTS attendance_owner_all   ON attendance;
-- DROP POLICY IF EXISTS fines_owner_all        ON fines;
-- DROP POLICY IF EXISTS activity_log_insert    ON activity_log;
-- DROP POLICY IF EXISTS activity_log_admin_read ON activity_log;
--
-- CREATE POLICY "Allow public all on teachers"   ON teachers   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on settings"   ON settings   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on batches"    ON batches    FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on students"   ON students   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on holidays"   ON holidays   FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on fines"      ON fines      FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public all on activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true);
