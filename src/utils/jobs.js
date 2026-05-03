import { uid, todayISO } from './helpers';

// Jobs let users track multiple positions / employers / pay-rate eras side
// by side. Each shift is tagged with a jobId; the shift's stored hourlyRate
// is locked at creation time so historical earnings never change when a job's
// current rate is later edited.
//
// Job shape:
//   { id, name, hourlyRate, color, archived (bool), createdAt (ISO) }
//
// Storage location: settings.jobs (array). settings.lastUsedJobId remembers
// which job the Quick Shift bar / new shift modal should default to.

// Curated palette for new-job color suggestions. Rotates so consecutive
// new jobs don't all look the same.
const JOB_COLORS = [
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // amber
  '#f472b6', // pink
  '#a78bfa', // violet
  '#fb923c', // orange
  '#22d3ee', // cyan
  '#f87171', // red
];

export function suggestJobColor(existing = []) {
  const used = new Set(existing.map((j) => j.color));
  return JOB_COLORS.find((c) => !used.has(c)) || JOB_COLORS[existing.length % JOB_COLORS.length];
}

export function makeJob({ name, hourlyRate, color }) {
  const safeName = String(name || '').trim() || 'Untitled job';
  const r = Number(hourlyRate);
  return {
    id: uid(),
    name: safeName,
    hourlyRate: Number.isFinite(r) && r >= 0 ? r : 0,
    color: color || JOB_COLORS[0],
    archived: false,
    createdAt: todayISO(),
  };
}

// Migration entry point: returns { jobs, lastUsedJobId } given the prior
// settings shape. Idempotent — calling it on an already-migrated settings
// just returns the existing jobs list.
export function ensureJobs(settings) {
  if (Array.isArray(settings.jobs) && settings.jobs.length > 0) {
    return {
      jobs: settings.jobs,
      lastUsedJobId: settings.lastUsedJobId || settings.jobs[0].id,
    };
  }

  // Seed from old wageHistory (one job per entry, oldest → newest) so users
  // upgrading don't lose their pay-rate eras. Falls back to defaultHourlyRate.
  const history = Array.isArray(settings.wageHistory) ? settings.wageHistory : [];
  let jobs = [];
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => a.startDate.localeCompare(b.startDate));
    jobs = sorted.map((entry, i) => makeJob({
      name: i === 0 ? 'Main job' : `Rate change ${i}`,
      hourlyRate: Number(entry.hourlyRate) || 0,
      color: JOB_COLORS[i % JOB_COLORS.length],
    }));
  } else {
    jobs = [makeJob({
      name: 'Main job',
      hourlyRate: Number(settings.defaultHourlyRate) || 0,
      color: JOB_COLORS[0],
    })];
  }

  // Most recent job is the active default (matches the previous "current
  // wage" notion when migrating from wageHistory).
  return { jobs, lastUsedJobId: jobs[jobs.length - 1].id };
}

export function getActiveJobs(jobs) {
  return (jobs || []).filter((j) => !j.archived);
}

export function findJob(jobs, id) {
  if (!id) return null;
  return (jobs || []).find((j) => j.id === id) || null;
}

// When we need a sensible default — last-used if still active, else first
// active job, else null.
export function defaultJobId(jobs, lastUsedJobId) {
  const active = getActiveJobs(jobs);
  if (active.find((j) => j.id === lastUsedJobId)) return lastUsedJobId;
  return active[0]?.id || jobs[0]?.id || null;
}

// Used by SettingsScreen — refuses to remove the last remaining job (we
// always need at least one so newly-created shifts have something to attach).
export function canRemoveJob(jobs) {
  return (jobs || []).length > 1;
}
