// ============================================
// Shared helpers - months, dates, CSV, downloads
// ============================================

/** "YYYY-MM" for the current month. */
export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** True when the value looks like "YYYY-MM" with a real 1-12 month. */
export function isValidMonthKey(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/**
 * Number of days in a "YYYY-MM" month.
 * Returns 0 for empty/invalid input so callers show an empty table instead of
 * computing with NaN.
 */
export function daysInMonth(monthKey: string): number {
  if (!isValidMonthKey(monthKey)) return 0;
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/** "YYYY-MM" -> day numbers [1..n]. Empty array when the key is invalid. */
export function monthDayNumbers(monthKey: string): number[] {
  const total = daysInMonth(monthKey);
  if (total <= 0) return [];
  return Array.from({ length: total }, (_, i) => i + 1);
}

/** Local (not UTC) "YYYY-MM-DD" for today. */
export function todayISODate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse "YYYY-MM-DD" as a LOCAL date.
 * `new Date('2024-03-01')` is parsed as UTC midnight, which renders as the
 * previous day in negative-offset timezones.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Human month label, e.g. "Mar 2024". Empty string for invalid input. */
export function formatMonthLabel(monthKey: string): string {
  if (!isValidMonthKey(monthKey)) return '';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

/** Safe number coercion - never returns NaN. */
export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Escape one CSV field (RFC 4180). */
export function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV document from a header row and body rows. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  // Leading BOM so Excel opens UTF-8 (incl. Urdu) correctly.
  return `\uFEFF${lines.join('\r\n')}`;
}

/** Object URL creator that revokes itself after download (no leaks). */
export function downloadBlob(content: BlobPart, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  // Firefox requires the anchor to be in the document for click() to work.
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoke on the next macrotask so the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  downloadBlob(buildCsv(headers, rows), filename, 'text/csv;charset=utf-8');
}

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}

/**
 * Parse pasted "name, phone, batch" lines.
 * Handles quoted fields, commas inside quotes, CRLF and blank lines.
 */
export interface ParsedStudentRow {
  name: string;
  phone: string;
  batchName: string | null;
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseStudentCsv(text: string): ParsedStudentRow[] {
  const rows: ParsedStudentRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    const name = (fields[0] || '').trim();
    if (!name) continue;
    const phone = (fields[1] || '').trim();
    const batchName = (fields[2] || '').trim() || null;
    rows.push({ name, phone, batchName });
  }
  return rows;
}

export function formatCurrencyPKR(value: unknown): string {
  return `PKR ${toNumber(value).toLocaleString()}`;
}
