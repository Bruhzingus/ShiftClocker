import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { computeShift } from './calculations';
import { formatDateShort, formatHM, decimalHours, formatMoney, todayISO } from './helpers';

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportCSV(shifts, settings) {
  const cols = ['Date', 'Start', 'End', 'Paid Hours'];
  if (settings.trackBreaks) cols.push('Break (min)', 'Break Paid');
  if (settings.trackOvertime) cols.push('Overtime (min)');
  if (settings.showWage) cols.push('Hourly Rate', 'Pay');
  if (settings.trackMileage) cols.push('Mileage (km)');
  if (settings.trackTags) cols.push('Tags');
  cols.push('Notes');

  const rows = [cols.map(csvEscape).join(',')];
  for (const s of shifts) {
    const c = computeShift(s, settings);
    const r = [s.date, s.start, s.end, decimalHours(c.paidMinutes).toFixed(2)];
    if (settings.trackBreaks) r.push(s.breakMinutes || 0, s.breakPaid ? 'yes' : 'no');
    if (settings.trackOvertime) r.push(s.overtimeMinutes || 0);
    if (settings.showWage) r.push((Number(s.hourlyRate) || 0).toFixed(2), c.pay.toFixed(2));
    if (settings.trackMileage) r.push(s.mileageKm || 0);
    if (settings.trackTags) r.push((s.tags || []).join(', '));
    r.push(s.notes || '');
    rows.push(r.map(csvEscape).join(','));
  }

  const csv = rows.join('\r\n');
  const path = `${FileSystem.documentDirectory}worklog-${todayISO()}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
}

export async function exportPDF(shifts, settings, summaryText, dateRangeText) {
  const headCols = ['Date', 'Times', 'Hours'];
  if (settings.trackBreaks) headCols.push('Break');
  if (settings.trackOvertime) headCols.push('OT');
  if (settings.showWage) headCols.push('Pay');
  if (settings.trackMileage) headCols.push('km');
  headCols.push('Notes');

  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const headerHtml = headCols.map((c) => `<th>${esc(c)}</th>`).join('');
  const bodyHtml = shifts
    .map((s) => {
      const c = computeShift(s, settings);
      const cells = [formatDateShort(s.date), `${s.start}–${s.end}`, formatHM(c.paidMinutes)];
      if (settings.trackBreaks) cells.push(`${s.breakMinutes || 0}m${s.breakPaid ? ' (paid)' : ''}`);
      if (settings.trackOvertime) cells.push(formatHM(Number(s.overtimeMinutes) || 0));
      if (settings.showWage) cells.push(formatMoney(c.pay));
      if (settings.trackMileage) cells.push(String(s.mileageKm || 0));
      cells.push(s.notes || '');
      return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`;
    })
    .join('');

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
