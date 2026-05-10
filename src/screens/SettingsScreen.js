import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal,
  Animated, Easing, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import {
  Toggle, Field, NumInput, StyledInput, SectionCard, Btn,
  ConfirmDialog, Divider, DateField, TimeField,
} from '../components/common';
import Dropdown from '../components/Dropdown';
import ScreenContainer from '../components/ScreenContainer';
import { Toast, FadeIn } from '../components/Animated';
import { THEME_LIST, THEMES } from '../theme/themes';
import { ensureJobs, makeJob, suggestJobColor, canRemoveJob, getActiveJobs, findJob } from '../utils/jobs';
import { PAY_PERIOD_TYPES, WEEK_START_OPTIONS } from '../utils/periods';
import { exportBackup, importBackup, BACKUP_FREQUENCIES, formatBackupAge } from '../utils/backup';
import { exportCSV, exportPDF, importShifts } from '../utils/export';
import { formatMoney, clampNumber, uid } from '../utils/helpers';

// ─── Sub-page header ──────────────────────────────────────────────────────────

function SubHeader({ title, onBack }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button">
        <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
      </Pressable>
      <Text style={s.title}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

// ─── Root nav row ─────────────────────────────────────────────────────────────

function NavRow({ icon, title, subtitle, onPress, danger, last }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.navRow, pressed && { backgroundColor: C.surfaceHov }, last && s.navRowLast]}
      accessibilityRole="button"
    >
      <View style={[s.navIcon, danger && { backgroundColor: C.dangerBg, borderColor: C.dangerBorder }]}>
        <Ionicons name={icon} size={18} color={danger ? C.danger : C.accent} />
      </View>
      <View style={s.navContent}>
        <Text style={[s.navTitle, danger && { color: C.danger }]}>{title}</Text>
        {subtitle ? <Text style={s.navSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textDim} />
    </Pressable>
  );
}

// ─── Quick Shift editor (modal) ────────────────────────────────────────────────

function QuickShiftEditor({ template, settings, onSave, onClose }) {
  const C = useTheme();
  const e = useStyles(makeEditorStyles);
  const [form, setForm] = useState(template || {});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name?.trim() && form.start && form.end;
  const activeJobs = getActiveJobs(settings.jobs || []);

  const save = () => {
    if (!valid) return;
    const tags = typeof form._tagsText === 'string'
      ? form._tagsText.split(',').map((t) => t.trim()).filter(Boolean)
      : (form.tags || []);
    const out = { ...form, tags };
    delete out._tagsText;
    out.name = out.name.trim();
    out.hourlyRate = Number(out.hourlyRate) || 0;
    out.breakMinutes = Number(out.breakMinutes) || 0;
    out.overtimeMinutes = Number(out.overtimeMinutes) || 0;
    onSave(out);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScreenContainer>
        <View style={e.header}>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.textSubtle} /></Pressable>
          <Text style={e.title}>{template?.name ? 'Edit quick shift' : 'New quick shift'}</Text>
          <Btn variant="primary" onPress={save} disabled={!valid} small>Save</Btn>
        </View>
        <ScrollView style={e.body} contentContainerStyle={{ gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Name">
            <StyledInput value={form.name || ''} onChangeText={(v) => set('name', v)} placeholder="e.g. Day 8h" maxLength={40} autoFocus />
          </Field>
          <View style={e.row2}>
            <View style={{ flex: 1 }}><TimeField label="Start" value={form.start || ''} onChange={(v) => set('start', v)} /></View>
            <View style={{ flex: 1 }}><TimeField label="End"   value={form.end   || ''} onChange={(v) => set('end',   v)} /></View>
          </View>
          {activeJobs.length > 0 && (
            <Field label="Default job" hint="optional">
              <Dropdown
                value={form.defaultJobId || ''}
                options={[
                  { value: '', label: 'No default (use last-used job)' },
                  ...activeJobs.map((j) => ({
                    value: j.id, label: j.name,
                    sublabel: settings.showWage ? `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` : undefined,
                  })),
                ]}
                onChange={(v) => set('defaultJobId', v)}
                placeholder="No default"
              />
            </Field>
          )}
          {settings.showWage && (
            <Field label="Fallback hourly rate" hint="when no job is set">
              <NumInput value={form.hourlyRate ?? settings.defaultHourlyRate} onChangeText={(v) => set('hourlyRate', v)} />
            </Field>
          )}
          <SectionCard style={{ gap: 4 }}>
            <Field label="Break (minutes)">
              <NumInput value={form.breakMinutes ?? 0} onChangeText={(v) => set('breakMinutes', v)} />
            </Field>
            <Toggle checked={!!form.breakPaid} onChange={(v) => set('breakPaid', v)} label="Paid break" />
          </SectionCard>
          {settings.trackOvertime && (
            <Field label="Overtime (minutes)">
              <NumInput value={form.overtimeMinutes ?? 0} onChangeText={(v) => set('overtimeMinutes', v)} />
            </Field>
          )}
          {settings.trackTags && (
            <Field label="Tags" hint="comma separated">
              <StyledInput
                value={form._tagsText !== undefined ? form._tagsText : (form.tags || []).join(', ')}
                onChangeText={(v) => set('_tagsText', v)}
                placeholder="opening, training"
              />
            </Field>
          )}
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

// ─── Job editor dialog ────────────────────────────────────────────────────────

const JOB_COLOR_CHOICES = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#fb923c','#22d3ee','#f87171'];

function JobEditDialog({ isNew, job, onChange, onSave, onRemove, onCancel, canRemove, settings }) {
  const C = useTheme();
  const es = useStyles(makeJobDialogStyles);
  const [showAddRaise, setShowAddRaise] = useState(false);
  const [newRaiseRate, setNewRaiseRate] = useState('');
  const [newRaiseDate, setNewRaiseDate] = useState('');

  const sortedHistory = useMemo(() => {
    const h = Array.isArray(job.rateHistory) ? job.rateHistory : [];
    return [...h].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  }, [job.rateHistory]);

  const addRaise = () => {
    const rate = Number(newRaiseRate);
    if (!Number.isFinite(rate) || rate < 0 || !newRaiseDate) return;
    const entry = { id: uid(), effectiveDate: newRaiseDate, rate };
    onChange({ rateHistory: [...(job.rateHistory || []), entry] });
    setNewRaiseRate(''); setNewRaiseDate(''); setShowAddRaise(false);
  };

  const removeRaise = (id) => {
    onChange({ rateHistory: (job.rateHistory || []).filter((r) => r.id !== id) });
  };

  return (
    <DialogShell title={isNew ? 'New job' : 'Edit job'} onCancel={onCancel}>
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Field label="Name">
          <StyledInput value={job.name || ''} onChangeText={(v) => onChange({ name: v })} placeholder="e.g. Cafe morning shifts" maxLength={40} autoFocus />
        </Field>
        <View style={{ height: 12 }} />
        {settings.showWage && (
          <Field label="Hourly rate" hint="$ per hour — base rate">
            <NumInput value={job.hourlyRate} onChangeText={(v) => onChange({ hourlyRate: v })} placeholder="0.00" />
          </Field>
        )}
        <View style={{ height: 12 }} />
        <Text style={es.fieldLabel}>COLOR</Text>
        <View style={es.colorRow}>
          {JOB_COLOR_CHOICES.map((color) => {
            const active = job.color === color;
            return (
              <Pressable key={color} onPress={() => onChange({ color })}
                style={[es.colorDot, { backgroundColor: color, borderColor: active ? C.text : 'transparent' }]}
              >
                {active && <Ionicons name="checkmark" size={14} color={C.bg} />}
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 12 }} />
        <Toggle checked={!!job.hasTips} onChange={(v) => onChange({ hasTips: v })} label="Tips enabled" hint="Shows a tips input for shifts at this job" />
        <Toggle checked={!!job.archived} onChange={(v) => onChange({ archived: v })} label="Archive this job" hint="Hides from new-shift pickers, keeps history" />

        {/* Raise history — only shown when enableRaises is on */}
        {settings.enableRaises && settings.showWage && (
          <>
            <View style={{ height: 14 }} />
            <Text style={es.fieldLabel}>RAISE HISTORY</Text>
            <Text style={es.raiseHint}>Rate effective on each shift's date is used for pay calculation.</Text>
            {sortedHistory.length === 0 ? (
              <Text style={es.raiseEmpty}>No raises recorded yet.</Text>
            ) : (
              sortedHistory.map((entry) => (
                <View key={entry.id} style={es.raiseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={es.raiseDate}>{entry.effectiveDate}</Text>
                    <Text style={es.raiseRate}>${Number(entry.rate).toFixed(2)}/hr</Text>
                  </View>
                  <Pressable onPress={() => removeRaise(entry.id)} hitSlop={10} style={es.raiseDelete}>
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </Pressable>
                </View>
              ))
            )}
            {showAddRaise ? (
              <View style={es.addRaiseForm}>
                <DateField label="Effective date" value={newRaiseDate} onChange={setNewRaiseDate} />
                <View style={{ height: 10 }} />
                <Field label="New rate ($/hr)">
                  <NumInput value={newRaiseRate} onChangeText={setNewRaiseRate} placeholder="0.00" />
                </Field>
                <View style={{ height: 10 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn variant="ghost" onPress={() => { setShowAddRaise(false); setNewRaiseRate(''); setNewRaiseDate(''); }} style={{ flex: 1 }}>Cancel</Btn>
                  <Btn variant="primary" onPress={addRaise} style={{ flex: 1 }}
                    disabled={!newRaiseDate || !newRaiseRate}>
                    Add
                  </Btn>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setShowAddRaise(true)} style={es.addRaiseBtn}>
                <Ionicons name="add" size={16} color={C.accent} />
                <Text style={es.addRaiseBtnText}>Add raise</Text>
              </Pressable>
            )}
          </>
        )}

        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canRemove && (
            <Btn variant="danger" onPress={onRemove} style={{ flex: 1 }}>
              <Ionicons name="trash-outline" size={16} color={C.danger} />
              <Text style={{ color: C.danger, fontWeight: '600', fontSize: 14 }}>Delete</Text>
            </Btn>
          )}
          <Btn variant="ghost" onPress={onCancel} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="primary" onPress={onSave} style={{ flex: 1 }}>{isNew ? 'Create' : 'Save'}</Btn>
        </View>
      </ScrollView>
    </DialogShell>
  );
}

function DialogShell({ title, children, onCancel }) {
  const es = useStyles(makeJobDialogStyles);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale   = React.useRef(new Animated.Value(0.95)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 120 }),
    ]).start();
  }, []);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[es.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} />
        <Animated.View style={[es.dialog, { transform: [{ scale }] }]}>
          <Text style={es.dialogTitle}>{title}</Text>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main settings screen ─────────────────────────────────────────────────────

export default function SettingsScreen({
  settings, setSettings, themeId, setThemeId,
  shifts, setShifts, quickShifts, setQuickShifts,
  onBack, onResetAll, onAfterRestore,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [subPage, setSubPage] = useState(null);

  // Go back within sub-pages before letting App handle it
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subPage) { setSubPage(null); return true; }
      return false;
    });
    return () => sub.remove();
  }, [subPage]);

  const [toast, setToast] = useState({ visible: false, message: '', tone: 'success' });
  const showToast = (msg, tone = 'success') => setToast({ visible: true, message: msg, tone });

  const upd = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  // ── Jobs state ──
  const jobs = useMemo(() => ensureJobs(settings).jobs, [settings.jobs]);
  const [editingJob, setEditingJob] = useState(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);

  const handleNewJob = () =>
    setEditingJob({ isNew: true, job: makeJob({ name: '', hourlyRate: settings.defaultHourlyRate, color: suggestJobColor(jobs) }) });

  const saveJob = (job, isNew) => {
    const trimmed = { ...job, name: String(job.name || '').trim().slice(0, 60) || 'Untitled job', hourlyRate: clampNumber(job.hourlyRate), archived: !!job.archived };
    setSettings((prev) => {
      const list = Array.isArray(prev.jobs) ? prev.jobs : [];
      const next = isNew ? [...list, trimmed] : list.map((j) => (j.id === trimmed.id ? trimmed : j));
      return { ...prev, jobs: next, lastUsedJobId: prev.lastUsedJobId || (isNew ? trimmed.id : prev.lastUsedJobId) };
    });
    setEditingJob(null);
    showToast(isNew ? 'Job created' : 'Job updated');
  };

  const removeJob = (id) => {
    setSettings((prev) => {
      const list = Array.isArray(prev.jobs) ? prev.jobs : [];
      if (!canRemoveJob(list)) return prev;
      const next = list.filter((j) => j.id !== id);
      return { ...prev, jobs: next, lastUsedJobId: prev.lastUsedJobId === id ? (next[0]?.id || null) : prev.lastUsedJobId };
    });
    setConfirmDeleteJob(null); setEditingJob(null);
    showToast('Job removed');
  };

  // ── Quick Shifts state ──
  const [editingQS, setEditingQS] = useState(null);
  const [confirmDeleteQS, setConfirmDeleteQS] = useState(null);

  const saveQS = (out) => {
    const exists = quickShifts.find((q) => q.id === out.id);
    setQuickShifts(exists ? quickShifts.map((q) => (q.id === out.id ? out : q)) : [...quickShifts, out]);
    setEditingQS(null);
    showToast(exists ? 'Quick shift updated' : 'Quick shift created');
  };

  const removeQS = (id) => {
    setQuickShifts(quickShifts.filter((q) => q.id !== id));
    setConfirmDeleteQS(null);
    showToast('Quick shift removed');
  };

  // ── Backup state ──
  const [busy, setBusy] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmReset, setConfirmReset] = useState(0);

  const handleManualBackup = async () => {
    setBusy('backup');
    try { await exportBackup(); setSettings((p) => ({ ...p, lastBackupAt: new Date().toISOString() })); showToast('Backup saved'); }
    catch (err) { showToast(err.message || 'Backup failed', 'danger'); }
    finally { setBusy(null); }
  };
  const handleRestore = async () => {
    setConfirmRestore(false); setBusy('restore');
    try {
      const res = await importBackup();
      if (res.cancelled) { setBusy(null); return; }
      if (typeof onAfterRestore === 'function') await onAfterRestore();
      showToast('Backup restored');
    } catch (err) { showToast(err.message || 'Restore failed', 'danger'); }
    finally { setBusy(null); }
  };

  // ── Shifts CSV/PDF state ──
  const [busyCSV, setBusyCSV] = useState(null);
  const handleExportCSV = async () => {
    setBusyCSV('exportCSV');
    try { await exportCSV(shifts, settings); }
    catch (err) { showToast(err.message || 'Export failed', 'danger'); }
    finally { setBusyCSV(null); }
  };
  const handleExportPDF = async () => {
    setBusyCSV('exportPDF');
    try { await exportPDF(shifts, settings); }
    catch (err) { showToast(err.message || 'Export failed', 'danger'); }
    finally { setBusyCSV(null); }
  };
  const handleImport = async () => {
    setBusyCSV('import');
    try {
      const result = await importShifts(shifts);
      if (!result) { setBusyCSV(null); return; }
      const { newShifts, added, skipped } = result;
      if (added > 0) {
        setShifts((prev) => [...newShifts, ...prev]);
        showToast(`Imported ${added} shift${added !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
      } else {
        showToast(skipped > 0 ? `All ${skipped} entries already exist` : 'No shifts found in file', 'danger');
      }
    } catch (err) { showToast(err.message || 'Import failed', 'danger'); }
    finally { setBusyCSV(null); }
  };

  // ─── Root page ─────────────────────────────────────────────────────────────

  if (!subPage) {
    return (
      <ScreenContainer>
        <View style={s.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
          </Pressable>
          <Text style={s.title}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={s.body} contentContainerStyle={{ padding: 16, gap: 6 }}>
          <Text style={s.groupLabel}>APPEARANCE</Text>
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            <NavRow icon="color-palette-outline" title="Theme" subtitle={THEME_LIST.find((t) => t.id === themeId)?.name} onPress={() => setSubPage('theme')} />
          </SectionCard>

          <Text style={s.groupLabel}>WORK</Text>
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            <NavRow icon="briefcase-outline" title="Jobs" subtitle={`${jobs.length} job${jobs.length !== 1 ? 's' : ''}`} onPress={() => setSubPage('jobs')} />
            <Divider />
            <NavRow icon="flash-outline" title="Quick Shifts" subtitle={`${quickShifts.length} template${quickShifts.length !== 1 ? 's' : ''}`} onPress={() => setSubPage('quickshifts')} />
            <Divider />
            <NavRow icon="calendar-outline" title="Pay Period" subtitle={PAY_PERIOD_TYPES.find((t) => t.value === (settings.payPeriod?.type || 'biweekly'))?.label} onPress={() => setSubPage('payperiod')} last />
          </SectionCard>

          <Text style={s.groupLabel}>TRACKING & DISPLAY</Text>
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            <NavRow icon="toggle-outline" title="Tracking" subtitle="Breaks, overtime, mileage, tags" onPress={() => setSubPage('tracking')} />
            <Divider />
            <NavRow icon="options-outline" title="Defaults" subtitle="Rates and multipliers" onPress={() => setSubPage('defaults')} last />
          </SectionCard>

          <Text style={s.groupLabel}>DATA</Text>
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            <NavRow icon="document-text-outline" title="Shifts Data" subtitle="Import / Export CSV or PDF" onPress={() => setSubPage('data')} />
            <Divider />
            <NavRow icon="cloud-outline" title="Backups" subtitle={formatBackupAge(settings.lastBackupAt)} onPress={() => setSubPage('backups')} last />
          </SectionCard>

          <View style={{ height: 8 }} />
          <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
            <NavRow icon="warning-outline" title="Danger Zone" onPress={() => setSubPage('danger')} danger last />
          </SectionCard>

          <Text style={s.footer}>ShiftyLog · data stored on this device</Text>
          <View style={{ height: 24 }} />
        </ScrollView>

        <Toast visible={toast.visible} message={toast.message} tone={toast.tone}
          icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
          onHide={() => setToast({ visible: false, message: '' })} />
      </ScreenContainer>
    );
  }

  // ─── Sub-pages ──────────────────────────────────────────────────────────────

  const goRoot = () => setSubPage(null);

  // ── Theme ──
  if (subPage === 'theme') {
    return (
      <ScreenContainer>
        <SubHeader title="Theme" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={s.subhint}>Switching is instant — no restart needed.</Text>
          <View style={[s.themeGrid, { marginTop: 12 }]}>
            {THEME_LIST.map((t) => {
              const palette = THEMES[t.id];
              const active = themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setThemeId(t.id)}
                  style={({ pressed }) => [
                    s.themeCard,
                    { backgroundColor: palette.surface, borderColor: active ? palette.accent : palette.border },
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <View style={s.themeSwatchRow}>
                    <View style={[s.themeSwatch, { backgroundColor: palette.bg }]} />
                    <View style={[s.themeSwatch, { backgroundColor: palette.surfaceHov }]} />
                    <View style={[s.themeSwatch, { backgroundColor: palette.accent }]} />
                    <View style={[s.themeSwatch, { backgroundColor: palette.accentBright }]} />
                  </View>
                  <View style={s.themeMeta}>
                    <Text style={[s.themeName, { color: palette.text }]} numberOfLines={1}>{t.name}</Text>
                    {active && <Ionicons name="checkmark-circle" size={13} color={palette.accent} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Jobs ──
  if (subPage === 'jobs') {
    return (
      <ScreenContainer>
        <SubHeader title="Jobs" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <Text style={s.subhint}>
            Each job has its own hourly rate. Existing shifts keep their original locked rate.
          </Text>
          {jobs.map((job) => (
            <Pressable key={job.id} onPress={() => setEditingJob({ isNew: false, job: { ...job } })}
              style={({ pressed }) => [s.jobRow, pressed && { opacity: 0.85 }]}>
              <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.jobName} numberOfLines={1}>
                  {job.name}{job.hasTips ? ' · tips' : ''}{job.archived ? ' · archived' : ''}
                </Text>
                {settings.showWage && (
                  <Text style={s.jobRate}>{formatMoney(Number(job.hourlyRate) || 0)}<Text style={s.jobRateUnit}>/hr</Text></Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
            </Pressable>
          ))}
          <Btn variant="primary" onPress={handleNewJob}>
            <Ionicons name="add" size={18} color={C.accentInk} />
            <Text style={s.primaryBtnText}>New job</Text>
          </Btn>
        </ScrollView>

        {editingJob && (
          <JobEditDialog
            isNew={editingJob.isNew} job={editingJob.job}
            onChange={(patch) => setEditingJob((e) => ({ ...e, job: { ...e.job, ...patch } }))}
            onSave={() => saveJob(editingJob.job, editingJob.isNew)}
            onRemove={() => setConfirmDeleteJob(editingJob.job.id)}
            onCancel={() => setEditingJob(null)}
            canRemove={!editingJob.isNew && canRemoveJob(jobs)}
            settings={settings}
          />
        )}
        <ConfirmDialog open={!!confirmDeleteJob} title="Delete this job?"
          message="Existing shifts keep their data — they just lose the job tag."
          confirmLabel="Delete" danger
          onConfirm={() => removeJob(confirmDeleteJob)} onCancel={() => setConfirmDeleteJob(null)} />
        <Toast visible={toast.visible} message={toast.message} tone={toast.tone}
          icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
          onHide={() => setToast({ visible: false, message: '' })} />
      </ScreenContainer>
    );
  }

  // ── Quick Shifts ──
  if (subPage === 'quickshifts') {
    return (
      <ScreenContainer>
        <View style={s.header}>
          <Pressable onPress={goRoot} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
          </Pressable>
          <Text style={s.title}>Quick Shifts</Text>
          <Btn variant="primary" small onPress={() => setEditingQS({ id: uid(), name: '', start: '08:00', end: '16:30', hourlyRate: settings.defaultHourlyRate, breakMinutes: 30, breakPaid: false, overtimeMinutes: 0, tags: [] })}>
            <Ionicons name="add" size={18} color={C.accentInk} />
            <Text style={s.primaryBtnText}>New</Text>
          </Btn>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {quickShifts.length === 0 ? (
            <View style={s.emptySection}>
              <Ionicons name="flash-outline" size={36} color={C.textDim} />
              <Text style={s.emptySectionText}>No quick shifts yet.</Text>
              <Text style={s.emptySectionHint}>Create templates to add shifts faster from the main screen.</Text>
            </View>
          ) : quickShifts.map((q) => {
            const job = q.defaultJobId ? findJob(settings.jobs, q.defaultJobId) : null;
            return (
              <Pressable key={q.id} onPress={() => setEditingQS({ ...q, _tagsText: (q.tags || []).join(', ') })}
                style={({ pressed }) => [s.qsCard, pressed && { backgroundColor: C.surfaceHov }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.qsName}>{q.name}</Text>
                  <Text style={s.qsMeta}>
                    {q.start} → {q.end}
                    {settings.trackBreaks && (q.breakMinutes || 0) > 0 ? `  ·  ${q.breakMinutes}m break` : ''}
                  </Text>
                  {job && <View style={s.qsJobRow}><View style={[s.jobDot, { backgroundColor: job.color || C.accent, width: 7, height: 7 }]} /><Text style={s.qsJobName}>{job.name}</Text></View>}
                </View>
                <View style={s.qsActions}>
                  <Pressable onPress={() => setEditingQS({ ...q })} style={s.qsActionBtn}>
                    <Ionicons name="pencil-outline" size={17} color={C.textFaint} />
                  </Pressable>
                  <Pressable onPress={() => setConfirmDeleteQS(q.id)} style={[s.qsActionBtn, s.qsActionDanger]}>
                    <Ionicons name="trash-outline" size={17} color={C.danger} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {editingQS && <QuickShiftEditor template={editingQS} settings={settings} onSave={saveQS} onClose={() => setEditingQS(null)} />}
        <ConfirmDialog open={!!confirmDeleteQS} title="Delete quick shift?"
          message="Only removes the template, not any shifts already added."
          confirmLabel="Delete" danger
          onConfirm={() => removeQS(confirmDeleteQS)} onCancel={() => setConfirmDeleteQS(null)} />
        <Toast visible={toast.visible} message={toast.message} tone={toast.tone}
          icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
          onHide={() => setToast({ visible: false, message: '' })} />
      </ScreenContainer>
    );
  }

  // ── Pay Period ──
  if (subPage === 'payperiod') {
    return (
      <ScreenContainer>
        <SubHeader title="Pay Period" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={s.subhint}>Configures the Pay Period tab on the home screen.</Text>
          <Field label="Period type">
            <Dropdown value={settings.payPeriod?.type || 'biweekly'} options={PAY_PERIOD_TYPES}
              onChange={(v) => upd('payPeriod', { ...(settings.payPeriod || {}), type: v })} />
          </Field>
          {(settings.payPeriod?.type === 'custom') && (
            <Field label="Period length (days)">
              <NumInput value={settings.payPeriod?.customDays ?? 14}
                onChangeText={(v) => upd('payPeriod', { ...(settings.payPeriod || {}), customDays: clampNumber(v, { min: 1, max: 365 }) })} />
            </Field>
          )}
          {['weekly','biweekly','custom'].includes(settings.payPeriod?.type || 'biweekly') && (
            <DateField label="Period start date" value={settings.payPeriod?.startDate || ''}
              onChange={(v) => upd('payPeriod', { ...(settings.payPeriod || {}), startDate: v })} />
          )}
          <Field label="Week starts on" hint="affects Week tab and weekly/bi-weekly periods">
            <Dropdown value={String(settings.payPeriod?.weekStartDay ?? '1')} options={WEEK_START_OPTIONS}
              onChange={(v) => upd('payPeriod', { ...(settings.payPeriod || {}), weekStartDay: v })} />
          </Field>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Tracking ──
  if (subPage === 'tracking') {
    return (
      <ScreenContainer>
        <SubHeader title="Tracking" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <SectionCard style={{ gap: 0 }}>
            <Toggle checked={settings.showWage}      onChange={(v) => upd('showWage', v)}      label="Show wage"  hint="Display hourly rate and pay" />
            <Divider />
            <Toggle checked={settings.trackOvertime} onChange={(v) => upd('trackOvertime', v)} label="Overtime"   hint="Track OT minutes at multiplier rate" />
            <Divider />
            <Toggle checked={settings.trackBreaks}   onChange={(v) => upd('trackBreaks', v)}   label="Breaks"     hint="Track paid / unpaid breaks" />
            <Divider />
            <Toggle checked={settings.trackMileage}  onChange={(v) => upd('trackMileage', v)}  label="Mileage"    hint="Track km driven per shift" />
            <Divider />
            <Toggle checked={settings.trackTags}     onChange={(v) => upd('trackTags', v)}     label="Tags"       hint="Categorize shifts with labels" />
          </SectionCard>
          <Text style={s.groupLabel}>WAGE CHANGES</Text>
          <SectionCard style={{ gap: 0 }}>
            <Toggle
              checked={!!settings.enableRaises}
              onChange={(v) => upd('enableRaises', v)}
              label="Raise / wage-change history"
              hint="Track rate changes per job; pay is calculated from the rate effective on each shift's date"
            />
          </SectionCard>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Defaults ──
  if (subPage === 'defaults') {
    const hasContent = settings.trackOvertime || settings.trackMileage;
    return (
      <ScreenContainer>
        <SubHeader title="Defaults" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {settings.trackOvertime && (
            <Field label="Overtime multiplier" hint="× regular rate">
              <NumInput value={settings.overtimeMultiplier ?? 1.5}
                onChangeText={(v) => upd('overtimeMultiplier', clampNumber(v, { min: 1, max: 5 }))} placeholder="1.5" />
            </Field>
          )}
          {settings.trackMileage && (
            <Field label="Mileage rate" hint="$ per km">
              <NumInput value={settings.mileageRate ?? 0}
                onChangeText={(v) => upd('mileageRate', clampNumber(v, { max: 100 }))} placeholder="0.00" />
            </Field>
          )}
          {!hasContent && (
            <Text style={s.subhint}>Enable Overtime or Mileage in Tracking to configure defaults.</Text>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Shifts Data ──
  if (subPage === 'data') {
    return (
      <ScreenContainer>
        <SubHeader title="Shifts Data" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={s.subhint}>
            Export all shifts or import from CSV / PDF. Imported shifts are merged — existing entries with the same date and times are skipped.
          </Text>
          <Text style={s.groupLabel}>EXPORT</Text>
          <View style={s.row2}>
            <Btn variant="primary" onPress={handleExportCSV} disabled={busyCSV === 'exportCSV' || shifts.length === 0} style={{ flex: 1 }}>
              <Ionicons name="document-text-outline" size={16} color={C.accentInk} />
              <Text style={s.primaryBtnText}>{busyCSV === 'exportCSV' ? 'Exporting…' : 'CSV'}</Text>
            </Btn>
            <Btn variant="secondary" onPress={handleExportPDF} disabled={busyCSV === 'exportPDF' || shifts.length === 0} style={{ flex: 1 }}>
              <Ionicons name="print-outline" size={16} color={C.text} />
              <Text style={s.secondaryBtnText}>{busyCSV === 'exportPDF' ? 'Exporting…' : 'PDF'}</Text>
            </Btn>
          </View>
          <Text style={s.groupLabel}>IMPORT</Text>
          <Btn variant="secondary" onPress={handleImport} disabled={busyCSV === 'import'}>
            <Ionicons name="cloud-upload-outline" size={16} color={C.text} />
            <Text style={s.secondaryBtnText}>{busyCSV === 'import' ? 'Importing…' : 'Import CSV or PDF'}</Text>
          </Btn>
        </ScrollView>
        <Toast visible={toast.visible} message={toast.message} tone={toast.tone}
          icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
          onHide={() => setToast({ visible: false, message: '' })} />
      </ScreenContainer>
    );
  }

  // ── Backups ──
  if (subPage === 'backups') {
    return (
      <ScreenContainer>
        <SubHeader title="Backups" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={s.backupBanner}>
            <Ionicons name="cloud-done-outline" size={22} color={C.accentBright} />
            <View style={{ flex: 1 }}>
              <Text style={s.backupBannerLabel}>Last backup</Text>
              <Text style={s.backupBannerValue}>{formatBackupAge(settings.lastBackupAt)}</Text>
            </View>
          </View>
          <Field label="Auto backup" hint="Skipped silently if app isn't opened">
            <Dropdown value={settings.backupFrequency || 'quarter'}
              options={BACKUP_FREQUENCIES.map((f) => ({ value: f.id, label: f.label }))}
              onChange={(v) => upd('backupFrequency', v)} />
          </Field>
          <View style={s.row2}>
            <Btn variant="primary" onPress={handleManualBackup} disabled={busy === 'backup'} style={{ flex: 1 }}>
              <Ionicons name="download-outline" size={16} color={C.accentInk} />
              <Text style={s.primaryBtnText}>{busy === 'backup' ? 'Saving…' : 'Backup now'}</Text>
            </Btn>
            <Btn variant="secondary" onPress={() => setConfirmRestore(true)} disabled={busy === 'restore'} style={{ flex: 1 }}>
              <Ionicons name="cloud-upload-outline" size={16} color={C.text} />
              <Text style={s.secondaryBtnText}>{busy === 'restore' ? 'Restoring…' : 'Restore'}</Text>
            </Btn>
          </View>
          <Text style={s.subhintSmall}>
            JSON snapshots of shifts, quick shifts, jobs, settings, and theme. Keep one in cloud storage to survive a factory reset.
          </Text>
        </ScrollView>
        <ConfirmDialog open={confirmRestore} title="Restore from backup?"
          message="Replaces all current data with the backup. This cannot be undone."
          confirmLabel="Choose file" danger onConfirm={handleRestore} onCancel={() => setConfirmRestore(false)} />
        <Toast visible={toast.visible} message={toast.message} tone={toast.tone}
          icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
          onHide={() => setToast({ visible: false, message: '' })} />
      </ScreenContainer>
    );
  }

  // ── Danger Zone ──
  if (subPage === 'danger') {
    return (
      <ScreenContainer>
        <SubHeader title="Danger Zone" onBack={goRoot} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={s.dangerCard}>
            <Text style={s.dangerHint}>Removes all shifts, quick shifts, jobs, and settings permanently.</Text>
            <Btn variant="danger" onPress={() => setConfirmReset(1)}>
              <Ionicons name="trash-outline" size={18} color={C.danger} />
              <Text style={s.dangerBtnText}>Reset all data</Text>
            </Btn>
          </View>
        </ScrollView>
        <ConfirmDialog open={confirmReset === 1} title="Reset all data?" danger
          message="Wipes shifts, quick shifts, jobs, and settings. Run a backup first."
          confirmLabel="Continue" onConfirm={() => setConfirmReset(2)} onCancel={() => setConfirmReset(0)} />
        <ConfirmDialog open={confirmReset === 2} title="Are you really sure?" danger
          message="Last chance. There is no undo."
          confirmLabel="Wipe everything" onConfirm={() => { setConfirmReset(0); onResetAll(); }} onCancel={() => setConfirmReset(0)} />
      </ScreenContainer>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 56,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },
  body: { flex: 1 },

  // Root nav
  groupLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    color: C.textFaint, marginTop: 14, marginBottom: 4, paddingHorizontal: 2,
  },
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  navRowLast: { borderBottomWidth: 0 },
  navIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder,
  },
  navContent: { flex: 1 },
  navTitle: { fontSize: 15, fontWeight: '500', color: C.text },
  navSub: { fontSize: 12, color: C.textFaint, marginTop: 1 },

  // Theme grid
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  themeCard: { width: '31.5%', borderRadius: 11, borderWidth: 2, padding: 7, gap: 5 },
  themeSwatchRow: { flexDirection: 'row', gap: 2 },
  themeSwatch: { flex: 1, height: 16, borderRadius: 4 },
  themeMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeName: { fontSize: 11, fontWeight: '700', flex: 1, marginRight: 3 },

  // Jobs
  jobRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.borderFaint,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  jobDot: { width: 12, height: 12, borderRadius: 6 },
  jobName: { fontSize: 15, fontWeight: '600', color: C.text },
  jobRate: { fontSize: 12, color: C.textFaint, fontVariant: ['tabular-nums'], marginTop: 2 },
  jobRateUnit: { fontSize: 11, color: C.textDim },

  // Quick Shifts
  qsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.borderFaint,
    padding: 14, gap: 12,
  },
  qsName: { fontSize: 15, fontWeight: '600', color: C.text },
  qsMeta: { fontSize: 12, color: C.textFaint, fontVariant: ['tabular-nums'], marginTop: 2 },
  qsJobRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  qsJobName: { fontSize: 11, color: C.textSubtle },
  qsActions: { flexDirection: 'row', gap: 6 },
  qsActionBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border,
  },
  qsActionDanger: { borderColor: C.dangerBorder, backgroundColor: C.dangerBg },

  // Empty sections
  emptySection: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptySectionText: { fontSize: 15, color: C.textMuted, fontWeight: '500', marginTop: 4 },
  emptySectionHint: { fontSize: 13, color: C.textFaint, textAlign: 'center' },

  // Backup
  backupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.accentBg, borderRadius: 12, borderWidth: 1, borderColor: C.accentBorder,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  backupBannerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: C.accentDim, marginBottom: 2 },
  backupBannerValue: { fontSize: 16, fontWeight: '700', color: C.text },

  // Danger
  dangerCard: {
    backgroundColor: C.dangerBg, borderRadius: 16, borderWidth: 1, borderColor: C.dangerBorder,
    padding: 16, gap: 12,
  },
  dangerHint: { fontSize: 13, color: C.textSubtle },
  dangerBtnText: { fontSize: 14, fontWeight: '600', color: C.danger },

  // Misc
  row2: { flexDirection: 'row', gap: 12 },
  subhint: { fontSize: 12, color: C.textFaint, lineHeight: 17 },
  subhintSmall: { fontSize: 11, color: C.textFaint, lineHeight: 16 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: C.text },
  footer: { textAlign: 'center', fontSize: 12, color: C.textDim, marginTop: 20 },
});

const makeJobDialogStyles = (C) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: {
    width: '100%', maxWidth: 380,
    backgroundColor: C.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border,
  },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: C.textFaint, marginBottom: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },

  // Raise history
  raiseHint: { fontSize: 11, color: C.textFaint, marginBottom: 8, lineHeight: 15 },
  raiseEmpty: { fontSize: 12, color: C.textDim, marginBottom: 6 },
  raiseRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.borderFaint,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
  },
  raiseDate: { fontSize: 11, color: C.textFaint, fontVariant: ['tabular-nums'] },
  raiseRate: { fontSize: 14, fontWeight: '600', color: C.accentBright, fontVariant: ['tabular-nums'] },
  raiseDelete: { padding: 4 },
  addRaiseForm: {
    backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.borderFaint,
    padding: 12, marginTop: 4, marginBottom: 6,
  },
  addRaiseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, marginTop: 4,
  },
  addRaiseBtnText: { fontSize: 13, fontWeight: '600', color: C.accent },
});

const makeEditorStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  body: { flex: 1, padding: 16 },
  row2: { flexDirection: 'row', gap: 12 },
});
