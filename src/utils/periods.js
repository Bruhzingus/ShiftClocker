import { isoFromDate, dateFromISO } from './helpers';

const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function shortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${M[m - 1]} ${d}`;
}

// Returns { dateFrom, dateTo, label } for the given period+offset, or null for 'all'.
export function computePeriodRange(period, offset, settings) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'all') return null;

  const pp = (settings && settings.payPeriod) || {};

  if (period === 'week') {
    const weekStartDay = Number(pp.weekStartDay ?? 1); // 1=Mon default
    const dow = today.getDay();
    const daysBack = (dow - weekStartDay + 7) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const from = isoFromDate(start);
    const to = isoFromDate(end);
    return { dateFrom: from, dateTo: to, label: `${shortDate(from)} – ${shortDate(to)}, ${start.getFullYear()}` };
  }

  if (period === 'month') {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      dateFrom: isoFromDate(start), dateTo: isoFromDate(end),
      label: `${M[start.getMonth()]} ${start.getFullYear()}`,
    };
  }

  if (period === 'year') {
    const y = today.getFullYear() + offset;
    return {
      dateFrom: isoFromDate(new Date(y, 0, 1)), dateTo: isoFromDate(new Date(y, 11, 31)),
      label: String(y),
    };
  }

  if (period === 'payperiod') return computePayRange(pp, offset, today);

  return null;
}

function computePayRange(pp, offset, today) {
  const type = pp.type || 'biweekly';

  if (type === 'monthly') {
    const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { dateFrom: isoFromDate(start), dateTo: isoFromDate(end), label: `${M[start.getMonth()]} ${start.getFullYear()}` };
  }

  if (type === 'semimonthly') return computeSemimonthly(offset, today);

  const periodDays =
    type === 'weekly' ? 7 :
    type === 'biweekly' ? 14 :
    Math.max(1, Number(pp.customDays) || 14);

  const refDate = dateFromISO(pp.startDate || isoFromDate(today));
  refDate.setHours(0, 0, 0, 0);

  const daysSince = Math.floor((today.getTime() - refDate.getTime()) / 86400000);
  const idx = Math.floor(daysSince / periodDays);

  const start = new Date(refDate);
  start.setDate(refDate.getDate() + (idx + offset) * periodDays);
  const end = new Date(start);
  end.setDate(start.getDate() + periodDays - 1);

  const from = isoFromDate(start);
  const to = isoFromDate(end);
  return { dateFrom: from, dateTo: to, label: `${shortDate(from)} – ${shortDate(to)}, ${start.getFullYear()}` };
}

function computeSemimonthly(offset, today) {
  const half = today.getDate() <= 15 ? 0 : 1;
  const totalIdx = today.getFullYear() * 24 + today.getMonth() * 2 + half + offset;
  const year = Math.floor(totalIdx / 24);
  const rem = ((totalIdx % 24) + 24) % 24;
  const month = Math.floor(rem / 2);
  const h = rem % 2;

  const start = h === 0 ? new Date(year, month, 1) : new Date(year, month, 16);
  const end   = h === 0 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  return {
    dateFrom: isoFromDate(start), dateTo: isoFromDate(end),
    label: `${M[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`,
  };
}

export const PAY_PERIOD_TYPES = [
  { value: 'weekly',      label: 'Weekly (7 days)' },
  { value: 'biweekly',    label: 'Bi-weekly (14 days)' },
  { value: 'semimonthly', label: 'Semi-monthly (1–15 / 16–end)' },
  { value: 'monthly',     label: 'Monthly (calendar month)' },
  { value: 'custom',      label: 'Custom (fixed days)' },
];

export const WEEK_START_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
];
