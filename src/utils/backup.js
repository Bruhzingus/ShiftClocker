import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { todayISO } from './helpers';

// All AsyncStorage keys that make up a complete user state snapshot. If new
// persistent state is ever added (new feature, new screen) it must be listed
// here, otherwise restoring a backup will silently leave that data behind.
export const BACKUP_KEYS = [
  'sl.shifts.v1',
  'sl.quickshifts.v1',
  'sl.settings.v1',
  'sl.sort.v1',
  'sl.theme.v1',
];

const BACKUP_FORMAT = 'shiftylog-backup';
const BACKUP_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

// Frequency choices the settings UI offers. Stored as days so adding a
// custom value later is just a matter of writing a number.
export const BACKUP_FREQUENCIES = [
  { id: 'off',      label: 'Off (manual only)', days: 0   },
  { id: 'monthly',  label: 'Every month',       days: 30  },
  { id: 'quarter',  label: 'Every 3 months',    days: 90  }, // default
  { id: 'half',     label: 'Every 6 months',    days: 180 },
  { id: 'yearly',   label: 'Every year',        days: 365 },
];

export const DEFAULT_BACKUP_FREQUENCY = 'quarter';

export function frequencyById(id) {
  return BACKUP_FREQUENCIES.find((f) => f.id === id) || BACKUP_FREQUENCIES[2];
}

// Build an in-memory backup blob from current AsyncStorage. Each value is
// stored as the raw JSON string we already have on disk so we never round-trip
// through parse → stringify (which would silently break unknown shapes).
async function snapshot() {
  const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
  const data = {};
  for (const [k, v] of pairs) {
    if (v != null) data[k] = v;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data,
  };
}

// Validate that a parsed object actually looks like one of our backups before
// we wipe storage and replace it. Defends against pasting in a random JSON
// file or a corrupted download.
function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'File is not valid JSON.';
  if (parsed.format !== BACKUP_FORMAT) return 'This file is not a ShiftyLog backup.';
  if (typeof parsed.version !== 'number') return 'Backup is missing a version number.';
  if (parsed.version > BACKUP_VERSION) return 'Backup was created by a newer app version. Update first.';
  if (!parsed.data || typeof parsed.data !== 'object') return 'Backup is missing its data block.';
  // Each key, if present, must be a string we can JSON.parse.
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v !== 'string') return `Backup entry "${k}" is malformed.`;
    try { JSON.parse(v); } catch { return `Backup entry "${k}" is not valid JSON.`; }
  }
  return null;
}

// Writes a JSON file to the app's document dir with a date-stamped filename.
// We use documentDirectory (not cacheDirectory) so auto-backups survive the
// OS purging the cache between runs. Filenames embed a millisecond timestamp
// to keep multiple same-day backups distinct.
function backupDir() {
  return FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
}

export async function writeBackupFile() {
  const blob = await snapshot();
  const json = JSON.stringify(blob, null, 2);
  const filename = `shiftylog-backup-${todayISO()}-${Date.now()}.json`;
  const dir = backupDir();
  if (!dir) throw new Error('No writable directory available on this device.');
  const path = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  return { path, filename, json };
}

// Manual export: write file then open the share sheet so the user picks
// where it goes (Drive, email, file manager).
export async function exportBackup() {
  const { path, filename } = await writeBackupFile();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Save ShiftyLog backup',
      UTI: 'public.json',
    });
  }
  return { path, filename };
}

// Auto-backup pathway: writes a file but doesn't open the share sheet.
// We keep just the most recent N (default 5) so storage doesn't grow forever.
export async function runAutoBackup({ keepCount = 5 } = {}) {
  const { path, filename } = await writeBackupFile();
  // Best-effort prune of older backups so we don't grow the document dir
  // forever. Keeps the most recent N — sort is lexicographic on the
  // YYYY-MM-DD-<ms> filename, which orders correctly without parsing.
  try {
    const dir = backupDir();
    if (dir) {
      const files = await FileSystem.readDirectoryAsync(dir);
      const ours = files
        .filter((f) => f.startsWith('shiftylog-backup-') && f.endsWith('.json'))
        .sort()
        .reverse();
      const stale = ours.slice(keepCount);
      await Promise.all(stale.map((f) =>
        FileSystem.deleteAsync(`${dir}${f}`, { idempotent: true }).catch(() => {})
      ));
    }
  } catch {
    // Pruning is best-effort — never let it block the backup write itself.
  }
  return { path, filename };
}

// Pick a backup file from the device, parse + validate, and atomically write
// every key into AsyncStorage. Returns the parsed snapshot so the caller can
// reload its in-memory state afterwards.
export async function importBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return { cancelled: true };
  const uri = result.assets?.[0]?.uri;
  if (!uri) throw new Error('Could not read selected file.');

  const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const err = validateBackup(parsed);
  if (err) throw new Error(err);

  // Wipe known keys first so removed-since-backup keys don't linger.
  await AsyncStorage.multiRemove(BACKUP_KEYS);
  const writes = Object.entries(parsed.data).filter(([k]) => BACKUP_KEYS.includes(k));
  if (writes.length > 0) {
    await AsyncStorage.multiSet(writes);
  }
  return { cancelled: false, snapshot: parsed };
}

// Returns true if enough time has elapsed since the last successful backup
// to run another one. Falls back to "yes, run one" the very first time.
export function shouldAutoBackup({ frequencyId, lastBackupAt }) {
  const freq = frequencyById(frequencyId);
  if (!freq.days) return false;
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= freq.days * DAY_MS;
}

// Friendly label for "last backup was N days ago" in the settings UI.
export function formatBackupAge(lastBackupAt) {
  if (!lastBackupAt) return 'Never';
  const then = new Date(lastBackupAt).getTime();
  if (!Number.isFinite(then)) return 'Never';
  const days = Math.floor((Date.now() - then) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
