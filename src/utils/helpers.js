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
  return [
    // ── Week 3 (May 4–8) ─────────────────────────────────────────────────────
    {
      id: uid(), date: '2026-05-08', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 14, tips: 0, tags: [],
      notes: 'Attended morning meeting and Trailed Jingcheng and Raj. We were focused on catching Raj up to speed with everything he missed during his vacation. We went to troubleshoot a computer issue at a feedlot, where we confirmed that the issue was not related to anything we service (internet, PC, switch). It was a software issue caused by the power interruptions. We called the software company, and fixed the issue. Spent the rest of the day testing conference room equipment.',
    },
    {
      id: uid(), date: '2026-05-07', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Attended morning meeting and trailed Jingcheng. Remotely troubleshooted a computer that has a monitor off, it was simply because the user was not logged in. Setup 9 Dell workstations for a new office, by using Windows Configuration Designer to install some programs and settings with MSI files, then by installing manually the following; Acrobat, Chrome + changing Windows settings, and BIOS settings. Did all required security and Windows updates.',
    },
    {
      id: uid(), date: '2026-05-06', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Attended meeting and trailed Jingcheng. Setup DNS for a server using Unify, and then went to a client to migrate everyone from temporary local accounts to active directory. This included preparing each user by resetting their password, creating shared mailboxes, creating new emails, downloading any saved browser passwords, and then using profwiz to transfer their accounts. Trained new users on their updated accounts. Went to a new site that has a camera down, opened up the box to find out there is no power, informed client then left to go home.',
    },
    {
      id: uid(), date: '2026-05-05', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Attended morning meeting, trailed Jingcheng. Troubleshooted an issue with a client\'s data drive remotely. Went to an office and installed Microsoft Outlook, and taught them how to use their new emails. Did email forwarding and transferring of old data.',
    },
    {
      id: uid(), date: '2026-05-04', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Attended morning meeting, discussed what how to handle HDMI from client PCs to local TVs. Because of security concerns and wireless interference, we decided to look into integrating HDMI extenders that have loopback and are able to be used with cat5e and over long distances. Took down a unused NAS and recovered the working hard drives to put in the other NAS to ensure that it has 5 good drives. Tested 8 hard drives and 2 SSDs and documented if they worked. Troubleshooted Network switch being off in the IT office, no idea why it wouldn\'t work with the specific power adapter, but switching it seemed to fix the issue.',
    },

    // ── Week 2 (Apr 27–May 1) ────────────────────────────────────────────────
    {
      id: uid(), date: '2026-05-01', start: '08:00', end: '17:00',
      hourlyRate: 0, breakMinutes: 45, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 22, tips: 0, tags: [],
      notes: 'Site visit to install a new managed switch and re-patch the server room. Labelled all ports. Tested connectivity across all VLANs after the reconfigure. Long drive out to the rural site.',
    },
    {
      id: uid(), date: '2026-04-30', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Completed imaging of 6 replacement laptops using our deployment USB. Enrolled devices in Intune and assigned profiles. Verified apps pushed correctly. Handed two units off to reception.',
    },
    {
      id: uid(), date: '2026-04-29', start: '08:30', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 30,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Stayed late to assist with a firewall migration. Backed up existing config, applied new ruleset, tested VPN tunnels. A few rules had to be tweaked to restore access to the print server.',
    },
    {
      id: uid(), date: '2026-04-28', start: '09:00', end: '17:00',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 8, tips: 0, tags: [],
      notes: 'Responded to a ticket about slow internet at a branch office. Found one of the ISP routers had defaulted its MTU after a power cycle. Reset MTU to 1500, speeds restored. Drove over to confirm on-site.',
    },
    {
      id: uid(), date: '2026-04-27', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Morning standup then documentation work — updated the network diagram for two client sites. Ran cable tracing in the server room to label unlabelled drops. Lunch with the team.',
    },

    // ── Week 1 (Apr 20–24) ───────────────────────────────────────────────────
    {
      id: uid(), date: '2026-04-24', start: '08:00', end: '16:00',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Short day — left a bit early. Spent most of the morning working on helpdesk queue. Resolved 4 tickets: printer offline (driver reinstall), email sync issue, VPN client update, and a password reset.',
    },
    {
      id: uid(), date: '2026-04-23', start: '08:00', end: '17:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 60,
      mileageKm: 31, tips: 0, tags: [],
      notes: 'Long day — drove out to a client whose file server ran out of disk space overnight. Moved archive data to an external NAS, freed up ~400 GB. Set up a storage report alert for the future. Overtime approved.',
    },
    {
      id: uid(), date: '2026-04-22', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Worked on onboarding checklist for a new hire starting next month. Created AD account, assigned licences, configured MFA. Set up their workstation profile and tested remote access.',
    },
    {
      id: uid(), date: '2026-04-21', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 0, tips: 0, tags: [],
      notes: 'Patch Tuesday follow-up — reviewed WSUS report and pushed deferred updates to 12 remaining machines. Two machines had update failures requiring manual intervention (KB conflict, disk full).',
    },
    {
      id: uid(), date: '2026-04-20', start: '08:00', end: '16:30',
      hourlyRate: 0, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0,
      mileageKm: 12, tips: 0, tags: [],
      notes: 'First day of the week. Morning meeting, then drove to a client to replace a dead UPS unit in their server room. Tested the new unit under load. Updated the asset register.',
    },
  ];
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
};
