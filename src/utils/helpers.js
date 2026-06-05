import { getCurrencySymbol } from './currency';

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

// Symbol defaults to the app-wide active currency (set from settings.currency
// in App.js). Callers may pass an explicit symbol to override.
export function formatMoney(n, symbol = getCurrencySymbol()) {
  const v = Number.isFinite(n) ? n : 0;
  return `${symbol}${v.toFixed(2)}`;
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

// Fresh installs start empty — the main screen shows a friendly empty state and
// prompts the user to add their first shift. (Real data is restored from a JSON
// backup; we never ship sample shifts in a production build.)
export function seedShifts() {
  return [];
}

export function seedQuickShifts() {
  return [
    { id: uid(), name: 'Regular 8h', start: '08:00', end: '16:30', hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0, tags: [] },
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

  // Currency symbol applied app-wide and in exports. App.js pushes this into
  // utils/currency.js on load so formatMoney() uses it everywhere.
  currency: '$',

  // Optional name shown atop CSV/PDF reports and prepended to export filenames
  // (e.g. employee or employer name). Blank = just the app name.
  reportName: '',

  // Jobs replace the previous wageHistory model. The migration in
  // utils/jobs.js seeds these lazily on first launch so users with existing
  // wage history don't lose their data.
  jobs: null,
  lastUsedJobId: null,

  // Backup schedule. Defaults to a reminder every 90 days; "off" disables
  // the auto-backup hook entirely (manual export still works).
  backupFrequency: 'quarter',
  lastBackupAt: null,

  // Pay period configuration used by the Period tab bar.
  payPeriod: {
    type: 'biweekly',
    startDate: null,
    customDays: 14,
    weekStartDay: '1', // '0'=Sun, '1'=Mon
  },

  // Raise / wage-change history. When enabled, each job tracks rateHistory
  // and pay is computed from the effective rate on the shift's date.
  enableRaises: false,

  // Local reminder notifications (no server / push). `time` is "HH:MM" 24h.
  // clockOutReminderHours: notify if still clocked in past this many hours (0 = off).
  reminders: {
    enabled: false,
    time: '19:00',
    clockOutReminderHours: 0,
  },
};
