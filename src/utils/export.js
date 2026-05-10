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

// ─── CSV export ───────────────────────────────────────────────────────────────

export async function exportCSV(shifts, settings) {
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
  const path = `${FileSystem.documentDirectory}worklog-${todayISO()}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportPDF(shifts, settings, summaryText = '', dateRangeText = '') {
  const headCols = ['Date', 'Times', 'Hours'];
  if (settings.trackBreaks)   headCols.push('Break');
  if (settings.trackOvertime) headCols.push('OT');
  if (settings.showWage)      headCols.push('Pay');
  if (settings.trackMileage)  headCols.push('km');
  headCols.push('Notes');

  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headerHtml = headCols.map((c) => `<th>${esc(c)}</th>`).join('');

  const bodyHtml = shifts.map((s) => {
    const c = computeShift(s, settings);
    const cells = [formatDateShort(s.date), `${s.start}–${s.end}`, formatHM(c.paidMinutes)];
    if (settings.trackBreaks)   cells.push(`${s.breakMinutes || 0}m${s.breakPaid ? ' (paid)' : ''}`);
    if (settings.trackOvertime) cells.push(formatHM(Number(s.overtimeMinutes) || 0));
    if (settings.showWage)      cells.push(formatMoney(c.pay));
    if (settings.trackMileage)  cells.push(String(s.mileageKm || 0));
    cells.push(s.notes || '');
    return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
  h1{font-size:18px;margin-bottom:4px}
  .sub{color:#666;font-size:10px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#18181b;color:#fff;padding:8px 6px;text-align:left;font-size:10px}
  td{padding:6px;border-bottom:1px solid #eee;vertical-align:top;word-break:break-word}
  tr:nth-child(even) td{background:#f8f8f8}
</style></head><body>
<h1>ShiftyLog</h1>
<div class="sub">${esc(dateRangeText)}<br/>${esc(summaryText)}</div>
<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
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

  // YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
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

  // 24h: "09:00" "9:00"
  let m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = +m[1], min = +m[2];
    if (h <= 23 && min <= 59) return `${pad2(h)}:${pad2(min)}`;
  }

  // 12h: "9:00 AM" "9:00AM" "9:00pm"
  m = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let h = +m[1];
    const min = +m[2];
    const pm = m[3].toLowerCase() === 'pm';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
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

function parseCSVRow(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if ((ch === ',' || ch === '\t') && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSVContent(text, existingShifts) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('File appears empty or has no data rows.');

  const rawHeaders = parseCSVRow(lines[0]);
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

  const rawRows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    const rawDate = (cols[dateIdx] || '').trim().replace(/^"|"$/g, '');
    if (!rawDate) continue;
    rawRows.push({
      rawDate,
      start:           startIdx    >= 0 ? cols[startIdx]?.trim()    : '',
      end:             endIdx      >= 0 ? cols[endIdx]?.trim()      : '',
      notes:           notesIdx    >= 0 ? cols[notesIdx]?.trim()    : '',
      breakMinutes:    breakIdx    >= 0 ? Number(cols[breakIdx])    || 0 : 0,
      breakPaid:       breakPaidIdx>= 0 ? /yes|true|1/i.test(cols[breakPaidIdx] || '') : false,
      hourlyRate:      rateIdx     >= 0 ? Number(cols[rateIdx])     || 0 : 0,
      tags:            tagsIdx     >= 0 ? (cols[tagsIdx] || '').split(',').map((t) => t.trim()).filter(Boolean) : [],
      overtimeMinutes: otIdx       >= 0 ? Number(cols[otIdx])       || 0 : 0,
      mileageKm:       mileIdx     >= 0 ? Number(cols[mileIdx])     || 0 : 0,
    });
  }

  if (rawRows.length === 0) throw new Error('No data rows found.');
  return buildShifts(rawRows, existingShifts);
}

// ─── PDF text extractor ───────────────────────────────────────────────────────
// Best-effort: reads the raw PDF bytes as UTF-8 text and extracts printable
// strings from PDF text operators. Works well for text-based PDFs (including
// those generated by ShiftyLog's own PDF export). Returns null if extraction
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

function buildShifts(rawRows, existingShifts) {
  let parsedDates = rawRows.map((r) => parseDateStr(r.rawDate));
  if (parsedDates.some((d) => d && !d.hasYear)) parsedDates = inferYears(parsedDates);

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

    newShifts.push({
      id: uid(), date: iso, start, end,
      hourlyRate: r.hourlyRate,
      jobId: null,
      breakMinutes: r.breakMinutes, breakPaid: r.breakPaid,
      overtimeMinutes: r.overtimeMinutes,
      mileageKm: r.mileageKm,
      tips: 0,
      notes: r.notes,
      tags: r.tags,
    });
  }

  return { newShifts, added: newShifts.length, skipped };
}

// ─── Main import entry point ──────────────────────────────────────────────────

export async function importShifts(existingShifts) {
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
  return parseCSVContent(text, existingShifts);
}
