import { parseTime } from './helpers';

// When raises are enabled, look up the job's rate history for the shift's date.
// Falls back to the shift's locked hourlyRate when raises are off or no entry applies.
function getEffectiveRate(shift, settings) {
  if (!settings.enableRaises) return Number(shift.hourlyRate) || 0;
  const job = shift.jobId
    ? (settings.jobs || []).find((j) => j.id === shift.jobId)
    : null;
  if (!job) return Number(shift.hourlyRate) || 0;
  if (Array.isArray(job.rateHistory) && job.rateHistory.length) {
    const applicable = job.rateHistory
      .filter((r) => r.effectiveDate <= shift.date)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    if (applicable.length) return Number(applicable[0].rate) || 0;
  }
  return Number(job.hourlyRate) || 0;
}

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

  const rate = getEffectiveRate(shift, settings);
  const mult = Number(settings.overtimeMultiplier) || 1.5;
  const pay = regularHours * rate + otHours * rate * mult;

  return { totalMinutes: total, paidMinutes, paidHours, regularHours, otHours, pay };
}
