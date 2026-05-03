import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import {
  Toggle, Field, NumInput, StyledInput, SectionCard, Btn, ConfirmDialog, Divider,
} from '../components/common';
import Dropdown from '../components/Dropdown';
import ScreenContainer from '../components/ScreenContainer';
import { Toast, FadeIn } from '../components/Animated';
import { THEME_LIST, THEMES } from '../theme/themes';
import {
  ensureJobs, makeJob, suggestJobColor, canRemoveJob, getActiveJobs,
} from '../utils/jobs';
import {
  exportBackup, importBackup, BACKUP_FREQUENCIES, formatBackupAge,
} from '../utils/backup';
import { formatMoney, clampNumber } from '../utils/helpers';

export default function SettingsScreen({
  settings, setSettings, themeId, setThemeId,
  shifts, setShifts, quickShifts, setQuickShifts,
  onBack, onResetAll, onAfterRestore,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [confirmReset, setConfirmReset] = useState(0);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(null); // 'backup' | 'restore' | null
  const [editingJob, setEditingJob] = useState(null);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);

  const [toast, setToast] = useState({ visible: false, message: '', tone: 'success' });
  const showToast = (message, tone = 'success') =>
    setToast({ visible: true, message, tone });

  const upd = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  // ─── Jobs ──────────────────────────────────────────────────────────────────
  const jobs = useMemo(() => ensureJobs(settings).jobs, [settings.jobs]);

  const handleNewJob = () => {
    setEditingJob({
      isNew: true,
      job: makeJob({
        name: '',
        hourlyRate: settings.defaultHourlyRate,
        color: suggestJobColor(jobs),
      }),
    });
  };

  const saveJob = (job, isNew) => {
    const trimmed = {
      ...job,
      name: String(job.name || '').trim().slice(0, 60) || 'Untitled job',
      hourlyRate: clampNumber(job.hourlyRate),
      archived: !!job.archived,
    };
    setSettings((prev) => {
      const list = Array.isArray(prev.jobs) ? prev.jobs : [];
      const next = isNew
        ? [...list, trimmed]
        : list.map((j) => (j.id === trimmed.id ? trimmed : j));
      const lastUsedJobId = prev.lastUsedJobId || (isNew ? trimmed.id : prev.lastUsedJobId);
      return { ...prev, jobs: next, lastUsedJobId };
    });
    setEditingJob(null);
    showToast(isNew ? 'Job created' : 'Job updated');
  };

  const removeJob = (id) => {
    setSettings((prev) => {
      const list = Array.isArray(prev.jobs) ? prev.jobs : [];
      if (!canRemoveJob(list)) return prev;
      const next = list.filter((j) => j.id !== id);
      const lastUsedJobId = prev.lastUsedJobId === id ? (next[0]?.id || null) : prev.lastUsedJobId;
      return { ...prev, jobs: next, lastUsedJobId };
    });
    setConfirmDeleteJob(null);
    setEditingJob(null);
    showToast('Job removed', 'success');
  };

  // ─── Backups ───────────────────────────────────────────────────────────────
  const handleManualBackup = async () => {
    setBusy('backup');
    try {
      await exportBackup();
      setSettings((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
      showToast('Backup saved');
    } catch (err) {
      showToast(err.message || 'Backup failed', 'danger');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setConfirmRestore(false);
    setBusy('restore');
    try {
      const res = await importBackup();
      if (res.cancelled) {
        setBusy(null);
        return;
      }
      // Reload all in-memory state from the restored AsyncStorage. App.js
      // exposes a callback that re-reads each storage key.
      if (typeof onAfterRestore === 'function') await onAfterRestore();
      showToast('Backup restored');
    } catch (err) {
      showToast(err.message || 'Restore failed', 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* ─── Theme picker ─── */}
        <FadeIn delay={0}>
          <Text style={s.sectionLabel}>THEME</Text>
          <SectionCard style={{ gap: 10 }}>
            <Text style={s.subhint}>Switching is instant — no restart needed.</Text>
            <View style={s.themeGrid}>
              {THEME_LIST.map((t) => {
                const palette = THEMES[t.id];
                const active = themeId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setThemeId(t.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${t.name} theme`}
                    style={({ pressed }) => [
                      s.themeCard,
                      { backgroundColor: palette.surface, borderColor: active ? palette.accent : palette.border },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <View style={s.themeSwatchRow}>
                      <View style={[s.themeSwatch, { backgroundColor: palette.bg }]} />
                      <View style={[s.themeSwatch, { backgroundColor: palette.accent }]} />
                      <View style={[s.themeSwatch, { backgroundColor: palette.accentBright }]} />
                    </View>
                    <View style={s.themeMeta}>
                      <Text style={[s.themeName, { color: palette.text }]} numberOfLines={1}>{t.name}</Text>
                      {active && (
                        <Ionicons name="checkmark-circle" size={16} color={palette.accent} />
                      )}
                    </View>
                    <Text style={[s.themeDesc, { color: palette.textFaint }]} numberOfLines={2}>
                      {t.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        </FadeIn>

        {/* ─── Jobs ─── */}
        <FadeIn delay={60}>
          <Text style={s.sectionLabel}>JOBS</Text>
          <SectionCard style={{ gap: 12 }}>
            <Text style={s.subhint}>
              Each job has its own hourly rate. Pick a job when adding a shift to track multiple employers
              or rate changes — existing shifts keep their original locked rate.
            </Text>

            {jobs.map((job) => (
              <Pressable
                key={job.id}
                onPress={() => setEditingJob({ isNew: false, job: { ...job } })}
                style={({ pressed }) => [s.jobRow, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`Edit job ${job.name}`}
              >
                <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.jobName} numberOfLines={1}>
                    {job.name}
                    {job.archived ? ' · archived' : ''}
                  </Text>
                  {settings.showWage && (
                    <Text style={s.jobRate}>
                      {formatMoney(Number(job.hourlyRate) || 0)}<Text style={s.jobRateUnit}>/hr</Text>
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
              </Pressable>
            ))}

            <Btn variant="primary" onPress={handleNewJob}>
              <Ionicons name="add" size={18} color={C.accentInk} />
              <Text style={s.primaryBtnText}>New job</Text>
            </Btn>
          </SectionCard>
        </FadeIn>

        {/* ─── Backups ─── */}
        <FadeIn delay={120}>
          <Text style={s.sectionLabel}>BACKUPS</Text>
          <SectionCard style={{ gap: 12 }}>
            <View style={s.backupBanner}>
              <Ionicons name="cloud-done-outline" size={22} color={C.accentBright} />
              <View style={{ flex: 1 }}>
                <Text style={s.backupBannerLabel}>Last backup</Text>
                <Text style={s.backupBannerValue}>{formatBackupAge(settings.lastBackupAt)}</Text>
              </View>
            </View>

            <Field label="Auto backup" hint="Skipped silently if app isn't opened">
              <Dropdown
                value={settings.backupFrequency || 'quarter'}
                options={BACKUP_FREQUENCIES.map((f) => ({ value: f.id, label: f.label }))}
                onChange={(v) => upd('backupFrequency', v)}
              />
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
              Backups include shifts, quick shifts, jobs, settings, and theme. They are JSON files saved to your device — keep one in cloud storage so a phone reset doesn't lose your data.
            </Text>
          </SectionCard>
        </FadeIn>

        {/* ─── Tracking toggles ─── */}
        <FadeIn delay={180}>
          <Text style={s.sectionLabel}>TRACKING</Text>
          <SectionCard style={{ gap: 0 }}>
            <Toggle checked={settings.showWage} onChange={(v) => upd('showWage', v)} label="Show wage" hint="Display hourly rate and pay" />
            <Divider />
            <Toggle checked={settings.trackOvertime} onChange={(v) => upd('trackOvertime', v)} label="Overtime" hint="Track OT minutes at multiplier rate" />
            <Divider />
            <Toggle checked={settings.trackBreaks} onChange={(v) => upd('trackBreaks', v)} label="Breaks" hint="Track paid / unpaid breaks" />
            <Divider />
            <Toggle checked={settings.trackMileage} onChange={(v) => upd('trackMileage', v)} label="Mileage" hint="Track km driven per shift" />
            <Divider />
            <Toggle checked={settings.trackTags} onChange={(v) => upd('trackTags', v)} label="Tags" hint="Categorize shifts with labels" />
          </SectionCard>
        </FadeIn>

        {/* ─── Defaults ─── */}
        <FadeIn delay={240}>
          <Text style={s.sectionLabel}>DEFAULTS</Text>
          <SectionCard style={{ gap: 14 }}>
            {settings.trackOvertime && (
              <Field label="Overtime multiplier" hint="× regular rate">
                <NumInput
                  value={settings.overtimeMultiplier ?? 1.5}
                  onChangeText={(v) => upd('overtimeMultiplier', clampNumber(v, { min: 1, max: 5 }))}
                  placeholder="1.5"
                />
              </Field>
            )}
            {settings.trackMileage && (
              <Field label="Mileage rate" hint="$ per km">
                <NumInput
                  value={settings.mileageRate ?? 0}
                  onChangeText={(v) => upd('mileageRate', clampNumber(v, { max: 100 }))}
                  placeholder="0.00"
                />
              </Field>
            )}
            {!settings.trackOvertime && !settings.trackMileage && (
              <Text style={s.placeholderHint}>Enable Overtime or Mileage above to configure their defaults.</Text>
            )}
          </SectionCard>
        </FadeIn>

        {/* ─── Danger zone ─── */}
        <FadeIn delay={300}>
          <Text style={[s.sectionLabel, { color: `${C.danger}cc` }]}>DANGER ZONE</Text>
          <View style={s.dangerCard}>
            <Text style={s.dangerHint}>Removes all shifts, quick shifts, jobs, and settings.</Text>
            <Btn variant="danger" onPress={() => setConfirmReset(1)}>
              <Ionicons name="trash-outline" size={18} color={C.danger} />
              <Text style={s.dangerBtnText}>Reset all data</Text>
            </Btn>
          </View>
        </FadeIn>

        <Text style={s.footer}>ShiftyLog · data stored on this device</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {editingJob && (
        <JobEditDialog
          isNew={editingJob.isNew}
          job={editingJob.job}
          onChange={(patch) => setEditingJob((e) => ({ ...e, job: { ...e.job, ...patch } }))}
          onSave={() => saveJob(editingJob.job, editingJob.isNew)}
          onRemove={() => setConfirmDeleteJob(editingJob.job.id)}
          onCancel={() => setEditingJob(null)}
          canRemove={!editingJob.isNew && canRemoveJob(jobs)}
          settings={settings}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteJob}
        title="Delete this job?"
        message="Existing shifts attached to this job keep their data — they just lose the job tag. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => removeJob(confirmDeleteJob)}
        onCancel={() => setConfirmDeleteJob(null)}
      />

      <ConfirmDialog
        open={confirmRestore}
        title="Restore from backup?"
        message="Replaces all current shifts, jobs, and settings with the backup. This cannot be undone."
        confirmLabel="Choose file"
        danger
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(false)}
      />

      <ConfirmDialog
        open={confirmReset === 1}
        title="Reset all data?"
        message="This wipes shifts, quick shifts, jobs, and settings. Run a backup first if you want to keep anything."
        confirmLabel="Continue"
        danger
        onConfirm={() => setConfirmReset(2)}
        onCancel={() => setConfirmReset(0)}
      />
      <ConfirmDialog
        open={confirmReset === 2}
        title="Are you really sure?"
        message="Last chance. There is no undo."
        confirmLabel="Wipe everything"
        danger
        onConfirm={() => { setConfirmReset(0); onResetAll(); }}
        onCancel={() => setConfirmReset(0)}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        tone={toast.tone}
        icon={toast.tone === 'danger' ? 'alert-circle' : 'checkmark-circle'}
        onHide={() => setToast({ visible: false, message: '' })}
      />
    </ScreenContainer>
  );
}

// ─── Job edit dialog ─────────────────────────────────────────────────────────
const JOB_COLOR_CHOICES = [
  '#60a5fa', '#34d399', '#fbbf24', '#f472b6',
  '#a78bfa', '#fb923c', '#22d3ee', '#f87171',
];

function JobEditDialog({ isNew, job, onChange, onSave, onRemove, onCancel, canRemove, settings }) {
  const C = useTheme();
  const es = useStyles(makeJobDialogStyles);
  return (
    <DialogShell title={isNew ? 'New job' : 'Edit job'} onCancel={onCancel}>
      <Field label="Name">
        <StyledInput
          value={job.name || ''}
          onChangeText={(v) => onChange({ name: v })}
          placeholder="e.g. Cafe morning shifts"
          maxLength={40}
          autoFocus
        />
      </Field>
      <View style={{ height: 12 }} />
      {settings.showWage && (
        <Field label="Hourly rate" hint="$ per hour">
          <NumInput
            value={job.hourlyRate}
            onChangeText={(v) => onChange({ hourlyRate: v })}
            placeholder="0.00"
          />
        </Field>
      )}
      <View style={{ height: 12 }} />
      <Text style={es.fieldLabel}>COLOR</Text>
      <View style={es.colorRow}>
        {JOB_COLOR_CHOICES.map((color) => {
          const active = job.color === color;
          return (
            <Pressable
              key={color}
              onPress={() => onChange({ color })}
              accessibilityRole="button"
              accessibilityLabel={`Color ${color}`}
              accessibilityState={{ selected: active }}
              style={[
                es.colorDot,
                { backgroundColor: color, borderColor: active ? C.text : 'transparent' },
              ]}
            >
              {active && <Ionicons name="checkmark" size={14} color={C.bg} />}
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 12 }} />
      <Toggle
        checked={!!job.archived}
        onChange={(v) => onChange({ archived: v })}
        label="Archive this job"
        hint="Hides it from new-shift pickers without deleting historical data"
      />
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
    </DialogShell>
  );
}

function DialogShell({ title, children, onCancel }) {
  const es = useStyles(makeJobDialogStyles);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.95)).current;
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

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },
  body: { flex: 1 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    color: C.textFaint, marginBottom: 8, marginTop: 18, paddingHorizontal: 2,
  },

  row2: { flexDirection: 'row', gap: 12 },

  subhint: { fontSize: 12, color: C.textFaint, lineHeight: 17 },
  subhintSmall: { fontSize: 11, color: C.textFaint, lineHeight: 16 },
  placeholderHint: { fontSize: 13, color: C.textFaint, fontStyle: 'italic' },

  primaryBtnText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: C.text },

  // Theme grid
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    gap: 8,
  },
  themeSwatchRow: { flexDirection: 'row', gap: 4 },
  themeSwatch: { flex: 1, height: 24, borderRadius: 6 },
  themeMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeName: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 6 },
  themeDesc: { fontSize: 11, lineHeight: 14 },

  // Jobs
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  jobDot: { width: 12, height: 12, borderRadius: 6 },
  jobName: { fontSize: 15, fontWeight: '600', color: C.text },
  jobRate: { fontSize: 12, color: C.textFaint, fontVariant: ['tabular-nums'], marginTop: 2 },
  jobRateUnit: { fontSize: 11, color: C.textDim },

  // Backup banner
  backupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.accentBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backupBannerLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.6, color: C.accentDim, marginBottom: 2,
  },
  backupBannerValue: { fontSize: 16, fontWeight: '700', color: C.text },

  dangerCard: {
    backgroundColor: C.dangerBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    padding: 16,
    gap: 12,
  },
  dangerHint: { fontSize: 13, color: C.textSubtle },
  dangerBtnText: { fontSize: 14, fontWeight: '600', color: C.danger },
  footer: { textAlign: 'center', fontSize: 12, color: C.textDim, marginTop: 32 },
});

const makeJobDialogStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  dialog: {
    width: '100%', maxWidth: 380,
    backgroundColor: C.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.border,
  },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
    color: C.textFaint, marginBottom: 6,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
});
