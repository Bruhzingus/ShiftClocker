import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import { computeShift } from './calculations';
import {
  formatDateShort, formatHM, decimalHours, formatMoney, todayISO, uid, pad2,
} from './helpers';

// ─── CSV escape ───────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Always export shifts in ascending date+start order so the file reads
// chronologically regardless of the order they were entered/imported.
function sortByDateAsc(shifts) {
  return [...shifts].sort((a, b) =>
    (a.date + ' ' + (a.start || '')).localeCompare(b.date + ' ' + (b.start || ''))
  );
}

// ─── Friendly export filenames ──────────────────────────────────────────────
// Produces e.g. "This Week Shifts 2026-06-05.csv" or, when a report name is set
// in Settings, "Jordan - This Week Shifts 2026-06-05.csv". Strips characters
// that are illegal in filenames on Android/iOS/Windows.

function sanitizeFilename(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|]/g, '') // illegal filename chars
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildExportFilename(settings, scopeLabel, ext) {
  const name  = sanitizeFilename(settings?.reportName);
  const scope = sanitizeFilename(scopeLabel) || 'Shifts';
  const base  = `${name ? `${name} - ` : ''}${scope} Shifts ${todayISO()}`;
  return `${base}.${ext}`;
}

// Full path in the document dir. Spaces are fine here — expo-file-system writes
// the literal filename, so the shared file keeps its readable name.
function docPath(filename) {
  return `${FileSystem.documentDirectory}${filename}`;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export async function exportCSV(rawShifts, settings, scopeLabel = '') {
  const shifts = sortByDateAsc(rawShifts);
  const cols = ['Date', 'Start', 'End', 'Paid Hours'];
  if (settings.trackBreaks)   cols.push('Break (min)', 'Break Paid');
  if (settings.trackOvertime) cols.push('Overtime (min)');
  if (settings.showWage)      cols.push('Hourly Rate', 'Pay');
  if (settings.trackMileage)  cols.push('Mileage (km)');
  if (settings.trackTags)     cols.push('Tags');
  cols.push('Notes');

  const rows = [cols.map(csvEscape).join(',')];
  for (const s of shifts) {
    const c = computeShift(s, settings);
    const r = [s.date, s.start, s.end, decimalHours(c.paidMinutes).toFixed(2)];
    if (settings.trackBreaks)   r.push(s.breakMinutes || 0, s.breakPaid ? 'yes' : 'no');
    if (settings.trackOvertime) r.push(s.overtimeMinutes || 0);
    if (settings.showWage)      r.push((Number(s.hourlyRate) || 0).toFixed(2), c.pay.toFixed(2));
    if (settings.trackMileage)  r.push(s.mileageKm || 0);
    if (settings.trackTags)     r.push((s.tags || []).join(', '));
    r.push(s.notes || '');
    rows.push(r.map(csvEscape).join(','));
  }

  const csv = rows.join('\r\n');
  const path = docPath(buildExportFilename(settings, scopeLabel, 'csv'));
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportPDF(rawShifts, settings, summaryText = '', dateRangeText = '', scopeLabel = '') {
  const shifts = sortByDateAsc(rawShifts);

  const headCols = ['Date', 'Times', 'Hours'];
  if (settings.trackBreaks)   headCols.push('Break');
  if (settings.trackOvertime) headCols.push('OT');
  if (settings.showWage)      headCols.push('Pay');
  if (settings.trackMileage)  headCols.push('km');
  headCols.push('Notes');

  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headerHtml = headCols.map((c) => `<th>${esc(c)}</th>`).join('');

  // Walk shifts once: build rows AND accumulate totals
  let totalPaidMinutes = 0;
  let totalRegularMinutes = 0;
  let totalOTMinutes = 0;
  let totalPay = 0;
  let totalTips = 0;
  let totalMileage = 0;
  let totalBreakMinutes = 0;

  const bodyHtml = shifts.map((s) => {
    const c = computeShift(s, settings);
    totalPaidMinutes    += c.paidMinutes;
    totalRegularMinutes += Math.round(c.regularHours * 60);
    totalOTMinutes      += Number(s.overtimeMinutes) || 0;
    totalPay            += c.pay;
    totalTips           += Number(s.tips) || 0;
    totalMileage        += Number(s.mileageKm) || 0;
    totalBreakMinutes   += Number(s.breakMinutes) || 0;

    const cells = [formatDateShort(s.date), `${s.start}–${s.end}`, formatHM(c.paidMinutes)];
    if (settings.trackBreaks)   cells.push(`${s.breakMinutes || 0}m${s.breakPaid ? ' (paid)' : ''}`);
    if (settings.trackOvertime) cells.push(formatHM(Number(s.overtimeMinutes) || 0));
    if (settings.showWage)      cells.push(formatMoney(c.pay));
    if (settings.trackMileage)  cells.push(String(s.mileageKm || 0));
    cells.push(s.notes || '');
    return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
  }).join('');

  // Build the totals/report section
  const totalsRows = [];
  const addRow = (label, value) =>
    totalsRows.push(`<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>`);

  addRow('Total shifts', String(shifts.length));
  addRow('Total hours', `${formatHM(totalPaidMinutes)}  (${decimalHours(totalPaidMinutes).toFixed(2)} hrs)`);
  if (settings.trackBreaks && totalBreakMinutes > 0) {
    addRow('Total break time', formatHM(totalBreakMinutes));
  }
  if (settings.trackOvertime && totalOTMinutes > 0) {
    addRow('Regular hours', formatHM(totalRegularMinutes));
    addRow('Overtime hours', formatHM(totalOTMinutes));
  }
  if (settings.showWage) {
    addRow('Total pay', formatMoney(totalPay));
    if (totalTips > 0) addRow('Total tips', formatMoney(totalTips));
    if (shifts.length > 0) {
      addRow('Average pay / shift', formatMoney(totalPay / shifts.length));
    }
  }
  if (settings.trackMileage && totalMileage > 0) {
    addRow('Total mileage', `${totalMileage.toFixed(1)} km`);
  }
  if (shifts.length > 0) {
    addRow('Average shift length', formatHM(Math.round(totalPaidMinutes / shifts.length)));
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
  h1{font-size:20px;margin-bottom:2px;letter-spacing:-0.3px}
  .reportName{font-size:13px;font-weight:600;color:#333;margin-bottom:4px}
  .sub{color:#666;font-size:10px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#18181b;color:#fff;padding:8px 6px;text-align:left;font-size:10px}
  td{padding:6px;border-bottom:1px solid #eee;vertical-align:top;word-break:break-word}
  tr:nth-child(even) td{background:#f8f8f8}
  .totals{margin-top:24px;page-break-inside:avoid}
  .totals h2{font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;color:#444;border-bottom:2px solid #18181b;padding-bottom:4px}
  .totals table{width:auto;min-width:280px;max-width:60%}
  .totals td{padding:5px 14px 5px 0;border-bottom:1px solid #eee;font-size:11px;background:#fff !important}
  .totals tr:nth-child(even) td{background:#fff !important}
  .totals td.lbl{color:#555}
  .totals td.val{color:#111;font-weight:600;text-align:right;white-space:nowrap}
</style></head><body>
<h1>ShiftClocker</h1>
${settings.reportName ? `<div class="reportName">${esc(settings.reportName)}</div>` : ''}
<div class="sub">${esc(dateRangeText)}<br/>${esc(summaryText)}</div>
<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>

<div class="totals">
  <h2>Summary</h2>
  <table>${totalsRows.join('')}</table>
</div>
</body></html>`;

  // printToFileAsync writes to a random temp name; copy it to a friendly name so
  // the share sheet shows e.g. "This Week Shifts 2026-06-05.pdf".
  const { uri } = await Print.printToFileAsync({ html });
  const path = docPath(buildExportFilename(settings, scopeLabel, 'pdf'));
  try {
    await FileSystem.copyAsync({ from: uri, to: path });
    await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
  } catch {
    // If the copy fails for any reason, fall back to sharing the temp file.
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
  }
}

// ─── Column alias table ───────────────────────────────────────────────────────
// Each key maps to an ordered list of aliases: exact matches are tried first
// (earlier entries), then substring containment. More-specific aliases must
// come before broad ones to avoid false positives (e.g. "break paid" before
// "break" so a "Break Paid" column is not matched as a break-minutes column).

const ALIASES = {
  // Fields where order matters (specific → broad)
  breakPaid: [
    'break paid', 'paid break', 'break paid?', 'lunch paid', 'paid lunch',
    'is break paid', 'break (paid)',
  ],
  break: [
    'break (min)', 'break_min', 'break min', 'break minutes', 'break_minutes',
    'break time', 'break length', 'break duration',
    'lunch (min)', 'lunch min', 'lunch minutes', 'lunch time', 'lunch break',
    'lunch break (min)', 'lunch',
    'rest (min)', 'rest break', 'rest',
    'meal break', 'meal (min)',
    'unpaid (min)', 'unpaid break',
    'break',
  ],
  overtime: [
    'overtime (min)', 'overtime_min', 'overtime min', 'overtime minutes',
    'overtime hours', 'overtime time',
    'ot (min)', 'ot min', 'ot minutes', 'ot hours',
    'extra hours', 'extra time', 'extra (min)', 'extra min',
    'additional hours', 'additional time', 'additional (min)',
    'over time', 'over-time',
    'overtime', 'ot',
  ],
  date: [
    'date', 'work date', 'shift date', 'day', 'work day',
  ],
  start: [
    'start time', 'time in', 'clock in', 'start', 'begin', 'time start',
    'shift start', 'from', 'in',
  ],
  end: [
    'end time', 'time out', 'clock out', 'end', 'finish',
    'time end', 'shift end', 'to', 'until', 'out',
  ],
  rate: [
    'hourly rate', 'pay rate', 'hourly wage', 'wage', 'rate per hour',
    'per hour', 'pay/hr', 'hourly pay', 'rate', 'hourly',
  ],
  pay: [
    'pay', 'total pay', 'gross pay', 'earnings', 'amount',
  ],
  mileage: [
    'mileage (km)', 'mileage (kms)', 'mileage km', 'distance (km)',
    'kilometers', 'kms', 'mileage (miles)', 'distance (miles)',
    'distance', 'mileage', 'km', 'miles', 'travel',
  ],
  job: [
    'job', 'client', 'employer', 'company', 'position', 'workplace',
    'work place', 'place of work',
  ],
  tags: [
    'tags', 'tag', 'categories', 'category', 'labels', 'label', 'type',
  ],
  notes: [
    'notes', 'note', 'description', 'comments', 'comment',
    'remarks', 'remark', 'details', 'detail', 'memo', 'info',
  ],
};

// Find the first header index matching any alias (exact first, then substring).
function findCol(headers, field) {
  const aliases = ALIASES[field] || [];
  // Pass 1: exact match
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (aliases.includes(h)) return i;
  }
  // Pass 2: header starts with or contains an alias (or alias contains header)
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const a of aliases) {
      if (h.startsWith(a) || h.includes(a) || a.includes(h)) return i;
    }
  }
  return -1;
}

// ─── Date / time parsers ──────────────────────────────────────────────────────

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4,
  june: 6, july: 7, august: 8, september: 9,
  october: 10, november: 11, december: 12,
};

function parseDateStr(str) {
  str = (str || '').trim();
  if (!str) return null;

  // YYYY-MM-DD  or  YYYY/MM/DD
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3], hasYear: true };

  // MM/DD/YYYY or M/D/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { year: +m[3], month: +m[1], day: +m[2], hasYear: true };

  // DD-MM-YYYY or DD.MM.YYYY
  m = str.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (m) return { year: +m[3], month: +m[2], day: +m[1], hasYear: true };

  // MM/DD or M/D (no year)
  m = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return { month: +m[1], day: +m[2], hasYear: false };

  // "MMM D, YYYY"  "MMM D"  "MMMM D, YYYY"
  m = str.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/i);
  if (m) {
    const mn = MONTH_NAMES[m[1].toLowerCase()];
    if (mn) return { year: m[3] ? +m[3] : undefined, month: mn, day: +m[2], hasYear: !!m[3] };
  }

  // "D MMM YYYY"  "D MMM"
  m = str.match(/^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/i);
  if (m) {
    const mn = MONTH_NAMES[m[2].toLowerCase()];
    if (mn) return { year: m[3] ? +m[3] : undefined, month: mn, day: +m[1], hasYear: !!m[3] };
  }

  // "Mon, Apr 27" (day-of-week prefix)
  m = str.match(/^[a-z]{2,3},?\s+([a-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/i);
  if (m) {
    const mn = MONTH_NAMES[m[1].toLowerCase()];
    if (mn) return { year: m[3] ? +m[3] : undefined, month: mn, day: +m[2], hasYear: !!m[3] };
  }

  return null;
}

function parseTimeStr(str) {
  str = (str || '').trim();
  if (!str) return null;
  // Normalise "a.m." / "p.m." → "am"/"pm" and a dot separator "9.00" → "9:00".
  str = str.replace(/([ap])\.?m\.?/i, '$1m').replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2');

  // 12h: "9:00 AM" "9:00AM" "9:00pm" — check before 24h so "12:00 am" maps right.
  let m = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let h = +m[1];
    const min = +m[2];
    const pm = m[3].toLowerCase() === 'pm';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    if (h <= 23 && min <= 59) return `${pad2(h)}:${pad2(min)}`;
  }

  // 12h with no minutes: "9 AM" "9pm"
  m = str.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (m) {
    let h = +m[1];
    const pm = m[2].toLowerCase() === 'pm';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    if (h <= 23) return `${pad2(h)}:00`;
  }

  // 24h: "09:00" "9:00"
  m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = +m[1], min = +m[2];
    if (h <= 23 && min <= 59) return `${pad2(h)}:${pad2(min)}`;
  }

  // Military with no colon: "0900" "1430" "900"
  m = str.match(/^(\d{1,2})(\d{2})$/);
  if (m) {
    const h = +m[1], min = +m[2];
    if (h <= 23 && min <= 59) return `${pad2(h)}:${pad2(min)}`;
  }

  // Bare hour "9" or "14"
  m = str.match(/^(\d{1,2})$/);
  if (m && +m[1] <= 23) return `${pad2(+m[1])}:00`;

  return null;
}

// ─── Year inference ───────────────────────────────────────────────────────────

function inferYears(parsedDates) {
  let asc = 0, desc = 0;
  for (let i = 1; i < parsedDates.length; i++) {
    const a = parsedDates[i - 1], b = parsedDates[i];
    if (!a || !b) continue;
    const av = a.month * 100 + a.day;
    const bv = b.month * 100 + b.day;
    if (bv > av) asc++;
    else if (bv < av) desc++;
  }
  const isDesc = desc >= asc;

  const today = new Date();
  const result = parsedDates.map((d) => (d ? { ...d } : null));

  if (isDesc) {
    const first = result.find((d) => d);
    let year = today.getFullYear();
    if (first && !first.hasYear && first.month > today.getMonth() + 1) year--;

    let prevM = null, prevD = null;
    for (let i = 0; i < result.length; i++) {
      const d = result[i];
      if (!d) continue;
      if (d.hasYear) { year = d.year; prevM = d.month; prevD = d.day; continue; }
      if (prevM !== null) {
        if (d.month > prevM || (d.month === prevM && d.day > prevD)) year--;
      }
      result[i] = { ...d, year, hasYear: true };
      prevM = d.month; prevD = d.day;
    }
  } else {
    const last = [...result].reverse().find((d) => d);
    let year = today.getFullYear();
    if (last && !last.hasYear && last.month > today.getMonth() + 1) year--;

    let nextM = null, nextD = null;
    for (let i = result.length - 1; i >= 0; i--) {
      const d = result[i];
      if (!d) continue;
      if (d.hasYear) { year = d.year; nextM = d.month; nextD = d.day; continue; }
      if (nextM !== null) {
        if (d.month > nextM || (d.month === nextM && d.day > nextD)) year--;
      }
      result[i] = { ...d, year, hasYear: true };
      nextM = d.month; nextD = d.day;
    }
  }

  return result;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVRow(line, delimiter = ',') {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delimiter && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// Pick the delimiter by counting candidates in the header line (outside quotes
// is approximated well enough by a raw count for a header row).
function detectDelimiter(headerLine) {
  const counts = {
    ',': (headerLine.match(/,/g) || []).length,
    '\t': (headerLine.match(/\t/g) || []).length,
    ';': (headerLine.match(/;/g) || []).length,
  };
  let best = ',', bestN = -1;
  for (const d of [',', '\t', ';']) {
    if (counts[d] > bestN) { best = d; bestN = counts[d]; }
  }
  return best;
}

function parseCSVContent(text, existingShifts, jobs = []) {
  // Strip a UTF-8 BOM so the first header ("date") still matches.
  const clean = text.replace(/^﻿/, '').trim();
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) throw new Error('File appears empty or has no data rows.');

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCSVRow(lines[0], delimiter);
  const headers = rawHeaders.map((h) => h.toLowerCase().trim().replace(/^"|"$/g, ''));

  const dateIdx   = findCol(headers, 'date');
  if (dateIdx < 0) throw new Error('No "Date" column found. Please ensure your file has a Date column.');

  const startIdx   = findCol(headers, 'start');
  const endIdx     = findCol(headers, 'end');
  const notesIdx   = findCol(headers, 'notes');
  const breakPaidIdx = findCol(headers, 'breakPaid');  // check BEFORE break
  const breakIdx   = findCol(headers, 'break');
  const rateIdx    = findCol(headers, 'rate');
  const tagsIdx    = findCol(headers, 'tags');
  const otIdx      = findCol(headers, 'overtime');
  const mileIdx    = findCol(headers, 'mileage');
  const jobIdx     = findCol(headers, 'job');

  // Decide once per file whether the break column is in hours or minutes,
  // based on the header text. We re-check per-value with a magnitude heuristic
  // because some sources omit the unit in the header entirely.
  const breakHeaderText = breakIdx >= 0 ? rawHeaders[breakIdx] : '';
  const headerSaysHours = /\b(hours?|hrs?)\b/i.test(breakHeaderText) && !/\bmin/i.test(breakHeaderText);

  const rawRows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i], delimiter);
    let rawDate = (cols[dateIdx] || '').trim().replace(/^"|"$/g, '');
    if (!rawDate) continue;

    let start = startIdx >= 0 ? (cols[startIdx] || '').trim() : '';
    let end   = endIdx   >= 0 ? (cols[endIdx]   || '').trim() : '';

    // Combined "2026-05-08 08:00" in the date cell when there's no Start column.
    if (!start && /\s/.test(rawDate)) {
      const parts = rawDate.split(/\s+/);
      const maybeTime = parts[parts.length - 1];
      if (parseTimeStr(maybeTime)) { start = maybeTime; rawDate = parts.slice(0, -1).join(' '); }
    }

    rawRows.push({
      rawDate, start, end,
      notes:           notesIdx    >= 0 ? cols[notesIdx]?.trim()    : '',
      breakMinutes:    breakIdx    >= 0 ? parseBreakValue(cols[breakIdx], headerSaysHours) : 0,
      breakPaid:       breakPaidIdx>= 0 ? /yes|true|1/i.test(cols[breakPaidIdx] || '') : false,
      hourlyRate:      rateIdx     >= 0 ? sanitizeNumber(cols[rateIdx]) : 0,
      tags:            tagsIdx     >= 0 ? (cols[tagsIdx] || '').split(',').map((t) => t.trim()).filter(Boolean) : [],
      overtimeMinutes: otIdx       >= 0 ? sanitizeNumber(cols[otIdx]) : 0,
      mileageKm:       mileIdx     >= 0 ? sanitizeNumber(cols[mileIdx]) : 0,
      jobName:         jobIdx      >= 0 ? (cols[jobIdx] || '').trim() : '',
    });
  }

  if (rawRows.length === 0) throw new Error('No data rows found.');
  return buildShifts(rawRows, existingShifts, jobs);
}

// Convert an imported break value to minutes.
//   - If the column header explicitly says "hours/hr" → multiply by 60.
//   - Otherwise, if the value is < 5, assume it's hours expressed as a decimal
//     (0.5 → 30 min, 1 → 60 min). Real break columns in minutes never use
//     values under 5, but external worklog tools commonly use 0.5/1.0/1.5 hrs.
//   - Otherwise treat as minutes.
function parseBreakValue(raw, headerSaysHours) {
  const num = sanitizeNumber(raw);
  if (num <= 0) return 0;
  if (headerSaysHours) return Math.round(num * 60);
  if (num < 5)         return Math.round(num * 60);
  return Math.round(num);
}

// Parse a number from a messy imported cell: strips currency symbols / units /
// thousands separators and copes with decimal comma (European "1.234,50").
function sanitizeNumber(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim().replace(/[^0-9.,\-]/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  if (hasComma && hasDot) {
    // The right-most separator is the decimal point.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else                                         s = s.replace(/,/g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    // "1,5" → decimal; "1,000" (3-digit groups) → thousands.
    if (parts.length === 2 && parts[1].length !== 3) s = `${parts[0]}.${parts[1]}`;
    else                                             s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ─── PDF text extractor ───────────────────────────────────────────────────────
// Best-effort: reads the raw PDF bytes as UTF-8 text and extracts printable
// strings from PDF text operators. Works well for text-based PDFs (including
// those generated by ShiftClocker's own PDF export). Returns null if extraction
// produces nothing recognisable.

function extractPDFStrings(raw) {
  const strings = [];

  // Extract strings from Tj operator: (text) Tj
  const tjRe = /\(([^)\\]{0,200}(?:\\.[^)\\]{0,200})*)\)\s*Tj/g;
  let m;
  while ((m = tjRe.exec(raw)) !== null) {
    const s = decodePDFString(m[1]);
    if (s.trim()) strings.push(s.trim());
  }

  // Extract strings from TJ array: [(str) num (str) …] TJ
  const tjArrRe = /\[([^\]]{0,1000})\]\s*TJ/g;
  while ((m = tjArrRe.exec(raw)) !== null) {
    const parts = m[1].match(/\(([^)\\]{0,200}(?:\\.[^)\\]{0,200})*)\)/g) || [];
    const joined = parts.map((p) => decodePDFString(p.slice(1, -1))).join('');
    if (joined.trim()) strings.push(joined.trim());
  }

  return strings;
}

function decodePDFString(s) {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}

// Heuristic: group extracted strings into table rows by detecting date-like
// strings as row delimiters, then treating following strings as column values.
function parsePDFStrings(strings, existingShifts) {
  // Skip header lines that don't look like data
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}|^[a-z]{3,}\.?\s+\d{1,2}/i;
  const TIME_RE = /^\d{1,2}:\d{2}(\s*(am|pm))?$/i;

  // Attempt 1: look for header row (a row containing "date" + at least "start" or "end")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(strings.length, 30); i++) {
    if (/\bdate\b/i.test(strings[i]) && strings.slice(i, i + 8).some((s) => /\bstart\b|\btime in\b|\bclock in\b/i.test(s))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx >= 0) {
    // Find where the header ends and data starts by finding the first date-like string
    let dataStart = headerIdx + 1;
    while (dataStart < strings.length && !DATE_RE.test(strings[dataStart])) dataStart++;

    // Build a pseudo-CSV: header line + data lines
    const headerStrings = strings.slice(headerIdx, dataStart);
    const dataStrings   = strings.slice(dataStart);

    // Group data strings into rows: each row starts with a date
    const rows = [];
    let current = [];
    for (const s of dataStrings) {
      if (DATE_RE.test(s) && current.length > 0) {
        rows.push(current);
        current = [];
      }
      current.push(s);
    }
    if (current.length > 0) rows.push(current);

    if (rows.length > 0) {
      // Map columns by position against header strings
      const rawRows = rows.map((cols) => ({
        rawDate:         cols[0] || '',
        start:           cols.find((s) => TIME_RE.test(s) && cols.indexOf(s) === 1) || cols[1] || '',
        end:             cols.find((s) => TIME_RE.test(s) && cols.indexOf(s) >= 2)  || cols[2] || '',
        notes:           cols[cols.length - 1] || '',
        breakMinutes:    0, breakPaid: false, hourlyRate: 0,
        tags: [], overtimeMinutes: 0, mileageKm: 0,
      }));
      return buildShifts(rawRows, existingShifts);
    }
  }

  // Attempt 2: scan all strings and treat consecutive date+time+time groups as shifts
  const rawRows = [];
  for (let i = 0; i < strings.length - 1; i++) {
    const d = parseDateStr(strings[i]);
    if (!d) continue;
    const start = parseTimeStr(strings[i + 1] || '');
    const end   = parseTimeStr(strings[i + 2] || '');
    if (!start) continue;
    rawRows.push({
      rawDate: strings[i], start: strings[i + 1] || '', end: strings[i + 2] || '',
      notes: '', breakMinutes: 0, breakPaid: false, hourlyRate: 0,
      tags: [], overtimeMinutes: 0, mileageKm: 0,
    });
    i += end ? 2 : 1;
  }

  if (rawRows.length === 0) return null;
  return buildShifts(rawRows, existingShifts);
}

// ─── Shared row → shift builder ───────────────────────────────────────────────

function buildShifts(rawRows, existingShifts, jobs = []) {
  let parsedDates = rawRows.map((r) => parseDateStr(r.rawDate));
  if (parsedDates.some((d) => d && !d.hasYear)) parsedDates = inferYears(parsedDates);

  // Lower-cased job name → job, for matching an imported "Job/Client" column.
  const jobByName = new Map((jobs || []).map((j) => [String(j.name || '').toLowerCase().trim(), j]));

  const existingKeys = new Set((existingShifts || []).map((s) => `${s.date}|${s.start}|${s.end}`));
  const newShifts = [];
  let skipped = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const d = parsedDates[i];
    if (!d || !d.year || !d.month || !d.day) { skipped++; continue; }

    const r = rawRows[i];
    const iso   = `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
    const start = parseTimeStr(r.start) || '09:00';
    const end   = parseTimeStr(r.end)   || '17:00';
    const key   = `${iso}|${start}|${end}`;

    if (existingKeys.has(key)) { skipped++; continue; }
    existingKeys.add(key);

    // Match an imported job/client name to an existing job; if no match, keep
    // the value as a tag so the information isn't lost.
    const matchedJob = r.jobName ? jobByName.get(r.jobName.toLowerCase().trim()) : null;
    const tags = [...(r.tags || [])];
    if (r.jobName && !matchedJob && !tags.includes(r.jobName)) tags.push(r.jobName);

    newShifts.push({
      id: uid(), date: iso, start, end,
      hourlyRate: r.hourlyRate || (matchedJob ? Number(matchedJob.hourlyRate) || 0 : 0),
      jobId: matchedJob ? matchedJob.id : null,
      breakMinutes: r.breakMinutes, breakPaid: r.breakPaid,
      overtimeMinutes: r.overtimeMinutes,
      mileageKm: r.mileageKm,
      tips: 0,
      notes: r.notes,
      tags,
    });
  }

  return { newShifts, added: newShifts.length, skipped };
}

// ─── Main import entry point ──────────────────────────────────────────────────

export async function importShifts(existingShifts, jobs = []) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'text/tab-separated-values',
           'text/comma-separated-values', 'application/pdf', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset  = result.assets?.[0] ?? result;
  const uri    = asset.uri;
  const name   = (asset.name || '').toLowerCase();
  const isPDF  = name.endsWith('.pdf') || (asset.mimeType || '').includes('pdf');

  if (isPDF) {
    // Read raw content — works for Latin-1 / ASCII text embedded in the PDF.
    const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 })
      .catch(() => null);

    if (!raw || !raw.startsWith('%PDF')) {
      throw new Error('Could not read the PDF file. Try exporting as CSV instead.');
    }

    const strings = extractPDFStrings(raw);
    if (strings.length === 0) {
      throw new Error('No readable text found in this PDF. Please use CSV export from your original app.');
    }

    const parsed = parsePDFStrings(strings, existingShifts);
    if (!parsed || parsed.added + parsed.skipped === 0) {
      throw new Error('Could not identify shift data in this PDF. Please use CSV export instead.');
    }
    return parsed;
  }

  // CSV / TSV / plain text
  const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  return parseCSVContent(text, existingShifts, jobs);
}
