// ============================================
// Database Service Layer - InsForge.dev
// Clean CRUD operations, Soft-Deletes & Calculations
// ============================================
//
// SCOPING: reads are filtered in the QUERY (teacher_id / batch_id /
// student_id) rather than fetched-then-filtered in JavaScript. The old
// approach downloaded every teacher's rows onto every user's device.
//
// Method names and signatures are kept backward compatible with the pages;
// new capabilities are added as extra optional parameters or new methods.

import { insforge } from '../lib/insforge';
import { isValidMonthKey, toNumber } from '../lib/utils';
import type {
  Batch,
  Student,
  Holiday,
  Attendance,
  Fine,
  ActivityLog,
  Settings,
  AttendanceStatus,
} from '../types/database';

// ----------------------------------------------------
// Actor (the teacher profile behind the signed-in account)
// ----------------------------------------------------

export interface Actor {
  teacherId: string;
  teacherName: string;
  isAdmin: boolean;
}

export interface AttendanceRules {
  minAttendancePercent: number;
  maxAllowedLeaves: number;
  fineAmount: number;
}

export const DEFAULT_RULES: AttendanceRules = {
  minAttendancePercent: 70,
  maxAllowedLeaves: 4,
  fineAmount: 500,
};

export interface StudentWithBatch extends Student {
  batch_name?: string;
}

export interface RecycleBinItems {
  batches: Batch[];
  students: StudentWithBatch[];
  holidays: Holiday[];
  fines: Fine[];
}

let actorCache: { value: Actor | null; at: number } | null = null;
const ACTOR_TTL_MS = 5_000;

/** Clear the cached actor - call after sign-in / sign-out / profile edits. */
export function invalidateActorCache(): void {
  actorCache = null;
}

/** Resolve the teacher profile belonging to the signed-in account. */
export async function getActor(force = false): Promise<Actor | null> {
  if (!force && actorCache && Date.now() - actorCache.at < ACTOR_TTL_MS) {
    return actorCache.value;
  }

  try {
    const { data: userData } = await insforge.auth.getCurrentUser();
    const userId = userData?.user?.id;
    if (!userId) {
      actorCache = { value: null, at: Date.now() };
      return null;
    }

    const { data, error } = await insforge.database
      .from('teachers')
      .select('id, name, is_admin')
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;

    const row = data?.[0] as { id: string; name: string; is_admin: boolean } | undefined;
    const value: Actor | null = row
      ? { teacherId: row.id, teacherName: row.name, isAdmin: Boolean(row.is_admin) }
      : null;

    actorCache = { value, at: Date.now() };
    return value;
  } catch (err) {
    // A missing `user_id`/`is_admin` column means migration 001 has not been
    // applied. Retry without the new columns so the app still works, and
    // resolve the actor by matching the signed-in account's email instead.
    if (isMissingColumnError(err)) {
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        const email = userData?.user?.email;
        const name = userData?.user?.profile?.name;

        const { data, error } = await insforge.database
          .from('teachers')
          .select('id, name')
          .eq('name', name || email || '')
          .limit(1);

        if (!error && data?.[0]) {
          const row = data[0] as { id: string; name: string };
          const value: Actor = {
            teacherId: row.id,
            teacherName: row.name,
            isAdmin: false,
          };
          actorCache = { value, at: Date.now() };
          return value;
        }
      } catch {
        // Fall through to the null result below.
      }
    }

    console.warn('Could not resolve actor:', err);
    actorCache = { value: null, at: Date.now() };
    return null;
  }
}

function isMissingColumnError(err: unknown): boolean {
  const message = String((err as { message?: string })?.message ?? '');
  return /column .* does not exist|Could not find the .* column/i.test(message);
}

export const dbService = {
  // ----------------------------------------------------
  // BATCHES
  // ----------------------------------------------------
  async getBatches(teacherId?: string, includeDeleted = false): Promise<Batch[]> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) return [];

    const runQuery = async (filterDeleted: boolean) => {
      let query = insforge.database
        .from('batches')
        .select('*')
        .eq('teacher_id', tid)
        .order('created_at', { ascending: false });
      if (filterDeleted) query = query.eq('is_deleted', false);
      return query;
    };

    const { data, error } = await runQuery(!includeDeleted);
    if (error) {
      // Tolerate a database where the batch soft-delete migration has not run.
      if (isMissingColumnError(error) && !includeDeleted) {
        const retry = await runQuery(false);
        if (retry.error) throw retry.error;
        return (retry.data || []) as Batch[];
      }
      throw error;
    }
    return (data || []) as Batch[];
  },

  async createBatch(name: string, teacherId?: string): Promise<Batch> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) throw new Error('No teacher profile is linked to this account.');

    const { data, error } = await insforge.database
      .from('batches')
      .insert([{ name, teacher_id: tid }])
      .select();

    if (error) throw error;
    return data?.[0] as Batch;
  },

  /**
   * Soft-delete a batch AND its students, attendance and fines, so the whole
   * class can be restored. The old version hard-deleted the batch, which
   * cascaded in SQL and destroyed all history with no recovery.
   */
  async deleteBatch(batchId: string): Promise<void> {
    const now = new Date().toISOString();

    const { data: studentRows, error: studentErr } = await insforge.database
      .from('students')
      .select('id')
      .eq('batch_id', batchId);
    if (studentErr) throw studentErr;

    const studentIds = (studentRows || []).map((s) => (s as { id: string }).id);

    if (studentIds.length > 0) {
      const { error: fineErr } = await insforge.database
        .from('fines')
        .update({ is_deleted: true, deleted_at: now })
        .in('student_id', studentIds)
        .eq('is_deleted', false);
      if (fineErr) throw fineErr;

      const { error: attErr } = await insforge.database
        .from('attendance')
        .update({ is_deleted: true, deleted_at: now })
        .in('student_id', studentIds)
        .eq('is_deleted', false);
      if (attErr) throw attErr;

      const { error: stdErr } = await insforge.database
        .from('students')
        .update({ is_deleted: true, deleted_at: now })
        .in('id', studentIds)
        .eq('is_deleted', false);
      if (stdErr) throw stdErr;
    }

    const { error } = await insforge.database
      .from('batches')
      .update({ is_deleted: true, deleted_at: now })
      .eq('id', batchId);

    if (error) {
      // If batch soft-delete is unavailable, do NOT hard-delete silently.
      throw new Error(
        `Could not archive batch (${error.message}). Run migrations/001_accounts_pin_and_rls.sql.`
      );
    }
  },

  /** Bring back a batch archived by deleteBatch, with its students/history. */
  async restoreBatch(batchId: string): Promise<void> {
    const { data: studentRows, error: studentErr } = await insforge.database
      .from('students')
      .select('id')
      .eq('batch_id', batchId);
    if (studentErr) throw studentErr;

    const studentIds = (studentRows || []).map((s) => (s as { id: string }).id);

    if (studentIds.length > 0) {
      const { error: stdErr } = await insforge.database
        .from('students')
        .update({ is_deleted: false, deleted_at: null })
        .in('id', studentIds);
      if (stdErr) throw stdErr;

      const { error: attErr } = await insforge.database
        .from('attendance')
        .update({ is_deleted: false, deleted_at: null })
        .in('student_id', studentIds)
        .eq('is_deleted', true);
      if (attErr) throw attErr;

      const { error: fineErr } = await insforge.database
        .from('fines')
        .update({ is_deleted: false, deleted_at: null })
        .in('student_id', studentIds)
        .eq('is_deleted', true);
      if (fineErr) throw fineErr;
    }

    const { error } = await insforge.database
      .from('batches')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', batchId);
    if (error) throw error;
  },

  /** Permanently remove a batch; SQL cascade also removes its students. */
  async permanentDeleteBatch(batchId: string): Promise<void> {
    const { error } = await insforge.database.from('batches').delete().eq('id', batchId);
    if (error) throw error;
  },

  // ----------------------------------------------------
  // STUDENTS (Soft Delete Support)
  // ----------------------------------------------------
  async getStudents(
    teacherId?: string,
    includeDeleted = false
  ): Promise<StudentWithBatch[]> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) return [];

    const batches = await this.getBatches(tid, includeDeleted);
    if (batches.length === 0) return [];

    const batchIds = batches.map((b) => b.id);
    const batchMap: Record<string, string> = {};
    batches.forEach((b) => {
      batchMap[b.id] = b.name;
    });

    let query = insforge.database
      .from('students')
      .select('*')
      .in('batch_id', batchIds)
      .order('name', { ascending: true });

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data || []) as Student[]).map((s) => ({
      ...s,
      batch_name: batchMap[s.batch_id] || 'Batch',
    }));
  },

  async createStudent(name: string, phone: string, batchId: string): Promise<Student> {
    const { data, error } = await insforge.database
      .from('students')
      .insert([
        {
          name,
          phone: phone || '',
          batch_id: batchId,
          is_deleted: false,
          deleted_at: null,
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] as Student;
  },

  async bulkCreateStudents(
    students: { name: string; phone: string; batch_id: string }[]
  ): Promise<number> {
    if (students.length === 0) return 0;
    const records = students.map((s) => ({
      name: s.name.trim(),
      phone: s.phone.trim(),
      batch_id: s.batch_id,
      is_deleted: false,
      deleted_at: null,
    }));

    const { data, error } = await insforge.database
      .from('students')
      .insert(records)
      .select('id');
    if (error) throw error;
    return (data || []).length;
  },

  /**
   * Soft-delete a student together with their attendance and fines, so the
   * student's history is restored with them and nothing is orphaned.
   */
  async softDeleteStudent(studentId: string): Promise<void> {
    const now = new Date().toISOString();

    const { error: fineErr } = await insforge.database
      .from('fines')
      .update({ is_deleted: true, deleted_at: now })
      .eq('student_id', studentId)
      .eq('is_deleted', false);
    if (fineErr) throw fineErr;

    const { error: attErr } = await insforge.database
      .from('attendance')
      .update({ is_deleted: true, deleted_at: now })
      .eq('student_id', studentId)
      .eq('is_deleted', false);
    if (attErr) throw attErr;

    const { error } = await insforge.database
      .from('students')
      .update({ is_deleted: true, deleted_at: now })
      .eq('id', studentId);

    if (error) throw error;
  },

  async restoreStudent(studentId: string): Promise<void> {
    const { error: stdErr } = await insforge.database
      .from('students')
      .update({ is_deleted: false, deleted_at: null })
      .eq('id', studentId);
    if (stdErr) throw stdErr;

    const { error: attErr } = await insforge.database
      .from('attendance')
      .update({ is_deleted: false, deleted_at: null })
      .eq('student_id', studentId)
      .eq('is_deleted', true);
    if (attErr) throw attErr;

    const { error: fineErr } = await insforge.database
      .from('fines')
      .update({ is_deleted: false, deleted_at: null })
      .eq('student_id', studentId)
      .eq('is_deleted', true);
    if (fineErr) throw fineErr;
  },

  async permanentDeleteStudent(studentId: string): Promise<void> {
    const { error } = await insforge.database
      .from('students')
      .delete()
      .eq('id', studentId);

    if (error) throw error;
  },

  // ----------------------------------------------------
  // HOLIDAYS
  // ----------------------------------------------------
  async getHolidays(teacherId?: string, includeDeleted = false): Promise<Holiday[]> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) return [];

    let query = insforge.database
      .from('holidays')
      .select('*')
      .eq('teacher_id', tid)
      .order('date', { ascending: false });

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Holiday[];
  },

  async createHoliday(date: string, label: string, teacherId?: string): Promise<Holiday> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) throw new Error('No teacher profile is linked to this account.');

    const { data, error } = await insforge.database
      .from('holidays')
      .insert([
        {
          date,
          label,
          teacher_id: tid,
          is_deleted: false,
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] as Holiday;
  },

  async softDeleteHoliday(holidayId: string): Promise<void> {
    const { error } = await insforge.database
      .from('holidays')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', holidayId);

    if (error) throw error;
  },

  async restoreHoliday(holidayId: string): Promise<void> {
    const { error } = await insforge.database
      .from('holidays')
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq('id', holidayId);

    if (error) throw error;
  },

  async permanentDeleteHoliday(holidayId: string): Promise<void> {
    const { error } = await insforge.database
      .from('holidays')
      .delete()
      .eq('id', holidayId);

    if (error) throw error;
  },

  // ----------------------------------------------------
  // ATTENDANCE (Bulk operations & formula)
  // ----------------------------------------------------
  async getMonthlyAttendance(
    month: string,
    studentIds: string[],
    includeDeleted = false
  ): Promise<Attendance[]> {
    if (studentIds.length === 0 || !isValidMonthKey(month)) return [];

    let query = insforge.database
      .from('attendance')
      .select('*')
      .eq('month', month)
      .in('student_id', studentIds);

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Attendance[];
  },

  /** All attendance for one student, across months. */
  async getStudentAttendance(studentId: string, includeDeleted = false): Promise<Attendance[]> {
    let query = insforge.database
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('day_number', { ascending: true });

    if (!includeDeleted) query = query.eq('is_deleted', false);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Attendance[];
  },

  /**
   * Save a month grid.
   *
   * A status of '' means "no mark" and DELETES that cell's row. The service
   * always supported this; the pages filtered cleared cells out before
   * calling it, so clearing a mark silently never reached the database.
   */
  async saveBulkAttendance(
    records: { student_id: string; month: string; day_number: number; status: AttendanceStatus | '' }[]
  ): Promise<void> {
    if (records.length === 0) return;

    const recordsByMonth = records.reduce((groups, record) => {
      if (!isValidMonthKey(record.month)) return groups;
      const group = groups[record.month] || [];
      group.push(record);
      groups[record.month] = group;
      return groups;
    }, {} as Record<string, typeof records>);

    for (const [month, monthRecords] of Object.entries(recordsByMonth)) {
      const recordsToSave = monthRecords
        .filter((r) => r.status === 'P' || r.status === 'A' || r.status === 'L')
        .map((r) => ({
          student_id: r.student_id,
          month,
          day_number: r.day_number,
          status: r.status,
          marked_at: new Date().toISOString(),
          is_deleted: false,
          deleted_at: null,
        }));

      const recordsToClear = monthRecords.filter((r) => r.status === '');

      // Upsert marked cells first, then delete only cleared cells. Respects the
      // schema's unique (student_id, month, day_number) constraint.
      if (recordsToSave.length > 0) {
        const { error: upsertError } = await insforge.database
          .from('attendance')
          .upsert(recordsToSave, { onConflict: 'student_id,month,day_number' });
        if (upsertError) throw upsertError;
      }

      if (recordsToClear.length > 0) {
        // Delete the cleared cells by grouping the day numbers per student and
        // issuing one short request per student.
        //
        // This replaces a single request that encoded every (student, day) pair
        // inside a nested `or=((...),(...))` filter. That form put all the data
        // in the URL, so it broke as soon as ANY mark already existed and a
        // cell was cleared - PostgREST rejected the quoted/parenthesised filter
        // (and would 414 once the query string grew). It is also why the very
        // first save of a month worked: with nothing to clear, this branch never
        // ran. Two .in() lists were avoided because they delete a Cartesian
        // product, which grouping by student also avoids.
        const daysByStudent = recordsToClear.reduce((groups, record) => {
          const list = groups[record.student_id] || [];
          if (!list.includes(record.day_number)) list.push(record.day_number);
          groups[record.student_id] = list;
          return groups;
        }, {} as Record<string, number[]>);

        for (const [studentId, dayNumbers] of Object.entries(daysByStudent)) {
          if (dayNumbers.length === 0) continue;
          const { error: deleteError } = await insforge.database
            .from('attendance')
            .delete()
            .eq('month', month)
            .eq('student_id', studentId)
            // Only the visible row for that day. Without this, clearing a cell
            // would also hard-delete a soft-deleted (recycle bin) row.
            .eq('is_deleted', false)
            .in('day_number', dayNumbers);
          if (deleteError) throw deleteError;
        }
      }
    }
  },

  /** Hard-clear one student's marks for a month. */
  async clearStudentMonth(studentId: string, month: string): Promise<void> {
    if (!isValidMonthKey(month)) return;
    const { error } = await insforge.database
      .from('attendance')
      .delete()
      .eq('student_id', studentId)
      .eq('month', month);
    if (error) throw error;
  },

  // ----------------------------------------------------
  // FINES (Auto calculation & custom fines)
  // ----------------------------------------------------
  async getFines(
    month?: string,
    studentIds?: string[],
    includeDeleted = false
  ): Promise<Fine[]> {
    // With no student filter there is nothing safe to return; the old version
    // returned every fine platform-wide. Callers must scope by students.
    if (studentIds !== undefined && studentIds.length === 0) return [];

    let query = insforge.database
      .from('fines')
      .select('*')
      .order('created_at', { ascending: false });

    if (month) {
      if (!isValidMonthKey(month)) return [];
      query = query.eq('month', month);
    }

    if (studentIds && studentIds.length > 0) {
      query = query.in('student_id', studentIds);
    }

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Fine[];
  },

  /** All fines for one student. */
  async getStudentFines(studentId: string, includeDeleted = false): Promise<Fine[]> {
    let query = insforge.database
      .from('fines')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (!includeDeleted) query = query.eq('is_deleted', false);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Fine[];
  },

  async createFine(
    studentId: string,
    month: string,
    amount: number,
    label: string,
    type: 'auto' | 'custom' = 'custom'
  ): Promise<Fine> {
    const { data, error } = await insforge.database
      .from('fines')
      .insert([
        {
          student_id: studentId,
          month,
          amount,
          label,
          type,
          status: 'pending',
          payment_date: null,
          is_deleted: false,
          deleted_at: null,
        },
      ])
      .select();

    if (error) throw error;
    return data?.[0] as Fine;
  },

  /** Batch insert; returns the number of fines actually created. */
  async bulkCreateFines(
    fines: { student_id: string; month: string; amount: number; label: string; type: 'auto' | 'custom' }[]
  ): Promise<number> {
    if (fines.length === 0) return 0;
    const records = fines.map((f) => ({
      student_id: f.student_id,
      month: f.month,
      amount: f.amount,
      label: f.label,
      type: f.type,
      status: 'pending',
      payment_date: null,
      is_deleted: false,
      deleted_at: null,
    }));

    const { data, error } = await insforge.database.from('fines').insert(records).select('id');
    if (error) throw error;
    return (data || []).length;
  },

  /** Student ids that already have an auto-fine for a month. */
  async getAutoFinedStudentIds(month: string, studentIds: string[]): Promise<string[]> {
    if (studentIds.length === 0 || !isValidMonthKey(month)) return [];
    const { data, error } = await insforge.database
      .from('fines')
      .select('student_id')
      .eq('month', month)
      .eq('type', 'auto')
      .eq('is_deleted', false)
      .in('student_id', studentIds);

    if (error) throw error;
    return (data || []).map((r) => (r as { student_id: string }).student_id);
  },

  async markFineAsPaid(fineId: string, paymentDate?: string): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .update({
        status: 'paid',
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
      })
      .eq('id', fineId);

    if (error) throw error;
  },

  async cancelFine(fineId: string): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .update({
        status: 'cancelled',
      })
      .eq('id', fineId);

    if (error) throw error;
  },

  async updateFineStatus(
    fineId: string,
    status: Fine['status'],
    paymentDate: string | null = null
  ): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .update({ status, payment_date: status === 'paid' ? paymentDate : null })
      .eq('id', fineId);
    if (error) throw error;
  },

  async softDeleteFine(fineId: string): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', fineId);

    if (error) throw error;
  },

  async restoreFine(fineId: string): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq('id', fineId);

    if (error) throw error;
  },

  async permanentDeleteFine(fineId: string): Promise<void> {
    const { error } = await insforge.database
      .from('fines')
      .delete()
      .eq('id', fineId);

    if (error) throw error;
  },

  // ----------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------
  async getSettings(teacherId?: string): Promise<Settings | null> {
    const tid = teacherId ?? (await getActor())?.teacherId;

    if (tid) {
      const { data, error } = await insforge.database
        .from('settings')
        .select('*')
        .eq('teacher_id', tid)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0] as Settings;
    }

    const { data: globalData, error: globalError } = await insforge.database
      .from('settings')
      .select('*')
      .is('teacher_id', null)
      .limit(1);
    if (globalError) throw globalError;
    return globalData && globalData.length > 0 ? (globalData[0] as Settings) : null;
  },

  /**
   * The rules that actually drive calculations, with defaults applied.
   * This is what makes the Settings page take effect; previously every caller
   * hardcoded 70% / 4 leaves / PKR 500.
   */
  async getRules(teacherId?: string): Promise<AttendanceRules> {
    try {
      const settings = await this.getSettings(teacherId);
      if (!settings) return DEFAULT_RULES;
      return {
        minAttendancePercent: toNumber(
          settings.min_attendance_percent,
          DEFAULT_RULES.minAttendancePercent
        ),
        maxAllowedLeaves: toNumber(
          settings.max_allowed_leaves,
          DEFAULT_RULES.maxAllowedLeaves
        ),
        fineAmount: toNumber(settings.fine_amount, DEFAULT_RULES.fineAmount),
      };
    } catch (err) {
      console.warn('Falling back to default rules:', err);
      return DEFAULT_RULES;
    }
  },

  // ----------------------------------------------------
  // RECYCLE BIN (Global & Teacher-specific)
  // ----------------------------------------------------
  async getRecycleBinItems(teacherId?: string): Promise<RecycleBinItems> {
    const tid = teacherId ?? (await getActor())?.teacherId;
    if (!tid) return { batches: [], students: [], holidays: [], fines: [] };

    // Fines are scoped to THIS teacher's students. The old version called
    // getFines() with no student filter, returning every deleted fine on the
    // platform to every teacher.
    const allBatches = await this.getBatches(tid, true);
    const allStudents = await this.getStudents(tid, true);
    const studentIds = allStudents.map((s) => s.id);

    const [deletedHolidays, deletedFines] = await Promise.all([
      this.getHolidays(tid, true),
      studentIds.length > 0 ? this.getFines(undefined, studentIds, true) : Promise.resolve([]),
    ]);

    return {
      batches: allBatches.filter((b) => b.is_deleted),
      students: allStudents.filter((s) => s.is_deleted),
      holidays: deletedHolidays.filter((h) => h.is_deleted),
      fines: deletedFines.filter((f) => f.is_deleted),
    };
  },

  /**
   * PLATFORM-WIDE recycle bin, for the Super Admin panel.
   *
   * Unlike getRecycleBinItems this is NOT scoped to one teacher. It only
   * returns everything when the database allows reading all rows (the default
   * "allow all" policies, i.e. RLS Part 3 NOT applied). With the stricter
   * per-teacher policies from Part 3, this returns only what the signed-in
   * admin is permitted to see - which is the correct, safe outcome.
   */
  async getAllRecycleBinItems(): Promise<RecycleBinItems> {
    const collect = async <T,>(table: string): Promise<T[]> => {
      const { data, error } = await insforge.database.from(table).select('*');
      if (error) {
        if (isMissingColumnError(error)) return [];
        throw error;
      }
      return (data || []) as T[];
    };

    const [allBatches, allStudents, allHolidays, allFines] = await Promise.all([
      collect<Batch>('batches'),
      collect<Student>('students'),
      collect<Holiday>('holidays'),
      collect<Fine>('fines'),
    ]);

    const isDeletedRow = (row: { is_deleted?: boolean }) => Boolean(row.is_deleted);

    return {
      batches: allBatches.filter(isDeletedRow),
      students: allStudents.filter(isDeletedRow),
      holidays: allHolidays.filter(isDeletedRow),
      fines: allFines.filter(isDeletedRow),
    };
  },

  /**
   * Permanently remove recycle-bin items older than `days`.
   * Scoped to this teacher and returns the REAL number of rows removed; the
   * old version purged globally and always reported 1.
   */
  async autoPurgeRecycleBinOlderThan30Days(days = 30): Promise<{ purgedCount: number }> {
    const actor = await getActor();
    if (!actor) return { purgedCount: 0 };

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const items = await this.getRecycleBinItems(actor.teacherId);
    let purgedCount = 0;

    const isExpired = (deletedAt: string | null) =>
      Boolean(deletedAt) && String(deletedAt) < cutoff;

    const purge = async (table: string, ids: string[]) => {
      for (const id of ids) {
        const { error } = await insforge.database.from(table).delete().eq('id', id);
        if (error) {
          console.warn(`Purge failed for ${table}/${id}:`, error.message);
          continue;
        }
        purgedCount += 1;
      }
    };

    await purge('fines', items.fines.filter((f) => isExpired(f.deleted_at)).map((f) => f.id));
    await purge(
      'holidays',
      items.holidays.filter((h) => isExpired(h.deleted_at)).map((h) => h.id)
    );
    await purge(
      'students',
      items.students.filter((s) => isExpired(s.deleted_at)).map((s) => s.id)
    );
    await purge('batches', items.batches.filter((b) => isExpired(b.deleted_at)).map((b) => b.id));

    return { purgedCount };
  },

  // ----------------------------------------------------
  // ACTIVITY LOG
  // ----------------------------------------------------
  async logActivity(
    teacherName: string,
    action: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await insforge.database.from('activity_log').insert([
        {
          teacher_name: teacherName || 'Unknown',
          action,
          timestamp: new Date().toISOString(),
          details: details || null,
        },
      ]);
    } catch {
      // Logging should never crash UI
    }
  },

  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    const { data, error } = await insforge.database
      .from('activity_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ActivityLog[];
  },

  // ----------------------------------------------------
  // ATTENDANCE CALCULATION FORMULA
  //   Working Days  = Days in month - Holidays
  //   Leaves up to max_allowed_leaves count as Present
  //   %             = (Present + Credited Leaves) / Working Days * 100
  //
  // Signature stays backward compatible; `minAttendancePercent` is a new
  // optional 6th argument so callers can pass the teacher's real setting.
  // ----------------------------------------------------
  calculateStudentAttendance(
    studentRecords: Attendance[],
    daysInMonth: number,
    holidayDates: string[],
    monthStr: string,
    maxAllowedLeaves = DEFAULT_RULES.maxAllowedLeaves,
    minAttendancePercent = DEFAULT_RULES.minAttendancePercent
  ) {
    // Guard against an empty/invalid month picker, which used to yield NaN.
    const totalDays =
      Number.isFinite(daysInMonth) && daysInMonth > 0 ? Math.floor(daysInMonth) : 0;

    if (totalDays === 0) {
      return {
        workingDays: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        allowedLeavesCredited: 0,
        percentage: 0,
        isDefaulter: false,
        markedDays: 0,
        hasRecords: false,
      };
    }

    const holidayDayNumbers = new Set(
      holidayDates
        .filter((h) => typeof h === 'string' && h.startsWith(monthStr))
        .map((h) => parseInt(h.split('-')[2], 10))
        .filter((d) => Number.isFinite(d) && d >= 1 && d <= 31)
    );

    let workingDays = 0;
    for (let d = 1; d <= totalDays; d++) {
      if (!holidayDayNumbers.has(d)) workingDays++;
    }
    if (workingDays <= 0) workingDays = totalDays;

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let markedDays = 0;

    studentRecords.forEach((rec) => {
      if (!rec || typeof rec.day_number !== 'number') return;
      // Don't count attendance on holidays
      if (holidayDayNumbers.has(rec.day_number)) return;
      if (rec.day_number < 1 || rec.day_number > totalDays) return;
      markedDays++;
      if (rec.status === 'P') presentCount++;
      else if (rec.status === 'A') absentCount++;
      else if (rec.status === 'L') leaveCount++;
    });

    // A student with no marks at all must NOT be reported as a 0% defaulter.
    // Previously this produced percentage 0 and isDefaulter true, which made
    // unmarked students look like defaulters and let auto-fines fine them.
    if (markedDays === 0) {
      return {
        workingDays,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        allowedLeavesCredited: 0,
        percentage: 0,
        isDefaulter: false,
        markedDays: 0,
        hasRecords: false,
      };
    }

    const allowedLeavesCredited = Math.min(leaveCount, Math.max(0, maxAllowedLeaves));
    const effectivePresent = presentCount + allowedLeavesCredited;
    const rawPercentage =
      workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 0;
    const percentage = Math.max(0, Math.min(100, rawPercentage));

    return {
      workingDays,
      presentCount,
      absentCount,
      leaveCount,
      allowedLeavesCredited,
      percentage,
      isDefaulter: percentage < minAttendancePercent,
      markedDays,
      hasRecords: true,
    };
  },
};
