-- =========================================================
-- TUITION PANEL - Complete PostgreSQL Schema for InsForge
-- =========================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    theme_preference VARCHAR(20) DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
    custom_color_settings JSONB DEFAULT NULL
);

-- 2. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    min_attendance_percent NUMERIC(5,2) DEFAULT 70.00 NOT NULL,
    fine_amount NUMERIC(10,2) DEFAULT 500.00 NOT NULL,
    max_allowed_leaves INT DEFAULT 4 NOT NULL,
    app_primary_color VARCHAR(50) DEFAULT '#6366f1',
    app_secondary_color VARCHAR(50) DEFAULT '#10b981',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_teacher_settings UNIQUE (teacher_id)
);

-- 3. Batches Table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 5. Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 31),
    status CHAR(1) NOT NULL CHECK (status IN ('P', 'A', 'L')),
    marked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    CONSTRAINT unique_student_daily_attendance UNIQUE (student_id, month, day_number)
);

-- 7. Fines Table
CREATE TABLE IF NOT EXISTS fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    amount NUMERIC(10,2) NOT NULL,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'auto' CHECK (type IN ('auto', 'custom')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    payment_date TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 8. Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_name VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    details JSONB DEFAULT NULL
);

-- =========================================================
-- Performance Indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_batches_teacher_id ON batches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_batch_id ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_is_deleted ON students(is_deleted);
CREATE INDEX IF NOT EXISTS idx_attendance_student_month ON attendance(student_id, month);
CREATE INDEX IF NOT EXISTS idx_fines_student_month ON fines(student_id, month);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines(status);
CREATE INDEX IF NOT EXISTS idx_holidays_teacher_date ON holidays(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);

-- =========================================================
-- Row Level Security (RLS) - Open for v1.0.0 (No auth)
-- =========================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow public access for v1.0.0 development
DO $$
BEGIN
    EXECUTE 'CREATE POLICY "Allow public all on teachers" ON teachers FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on settings" ON settings FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on batches" ON batches FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on students" ON students FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on holidays" ON holidays FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on fines" ON fines FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow public all on activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
