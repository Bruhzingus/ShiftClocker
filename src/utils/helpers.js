export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const pad2 = (n) => String(n).padStart(2, '0');

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateFromISO(iso) {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoFromDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function hmFromDate(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseTime(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function timeFromHM(hm) {
  const mins = parseTime(hm);
  if (mins === null) return new Date();
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

export function formatHM(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function decimalHours(totalMinutes) {
  return Math.round((totalMinutes / 60) * 100) / 100;
}

export function formatMoney(n) {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

export function formatDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateMed(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export function formatDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

// Numeric input sanitiser used by ShiftModal / QuickShifts editor / job
// editor. Caps the result at MAX so a paste accident can't produce a 12-digit
// rate that would later overflow display formatting; clamps negatives to 0.
export function clampNumber(v, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function seedShifts() {
  const ago = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoFromDate(d);
  };
  return [
    {
      id: uid(), date: todayISO(), start: '09:00', end: '17:30',
      hourlyRate: 25, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 12, notes: 'Welcome to ShiftyLog! Long-press any row to enter multi-select mode. Tap a row to edit. Use the Quick Shift bar above to add a shift with pre-filled settings.', tags: ['onboarding'],
    },
    {
      id: uid(), date: ago(1), start: '08:00', end: '16:00',
      hourlyRate: 25, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 8, notes: 'Trained the new hire on POS system. Slow afternoon — reorganized back stock.', tags: ['training'],
    },
    {
      id: uid(), date: ago(2), start: '14:00', end: '22:30',
      hourlyRate: 25, breakMinutes: 45, breakPaid: false, overtimeMinutes: 60,
      mileageKm: 8, notes: 'Closing shift. Stayed an hour late to cover for Alex. Cash-out balanced.', tags: ['closing'],
    },
  ];
}

export function seedQuickShifts() {
  return [
    { id: uid(), name: 'Day 8h', start: '09:00', end: '17:30', hourlyRate: 25, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0, tags: [] },
    { id: uid(), name: 'Night 12h', start: '18:00', end: '06:00', hourlyRate: 28, breakMinutes: 60, breakPaid: true, overtimeMinutes: 0, tags: ['night'] },
  ];
}

export const DEFAULT_SETTINGS = {
  showWage: true,
  trackOvertime: true,
  trackMileage: true,
  trackBreaks: true,
  trackTags: true,
  defaultHourlyRate: 25,
  overtimeMultiplier: 1.5,
  mileageRate: 0.7,

  // Jobs replace the previous wageHistory model. The migration in
  // utils/jobs.js seeds these lazily on first launch so users with existing
  // wage history don't lose their data.
  jobs: null,
  lastUsedJobId: null,

  // Backup schedule. Defaults to a reminder every 90 days; "off" disables
  // the auto-backup hook entirely (manual export still works).
  backupFrequency: 'quarter',
  lastBackupAt: null,
};
