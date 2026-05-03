import { parseTime } from './helpers';

export function computeShift(shift, settings) {
  const s = parseTime(shift.start), e = parseTime(shift.end);
  if (s === null || e === null) return { totalMinutes: 0, paidMinutes: 0, paidHours: 0, regularHours: 0, otHours: 0, pay: 0 };

  let total = e - s;
  if (total <= 0) total += 24 * 60;

  const breakMin = settings.trackBreaks ? (Number(shift.breakMinutes) || 0) : 0;
  const breakDeduct = shift.breakPaid ? 0 : breakMin;
  const paidMinutes = Math.max(0, total - breakDeduct);
  const paidHours = paidMinutes / 60;

  const otMin = settings.trackOvertime ? (Number(shift.overtimeMinutes) || 0) : 0;
  const otHours = Math.min(otMin / 60, paidHours);
  const regularHours = Math.max(0, paidHours - otHours);

  const rate = Number(shift.hourlyRate) || 0;
  const mult = Number(settings.overtimeMultiplier) || 1.5;
  const pay = regularHours * rate + otHours * rate * mult;

  return { totalMinutes: total, paidMinutes, paidHours, regularHours, otHours, pay };
}
