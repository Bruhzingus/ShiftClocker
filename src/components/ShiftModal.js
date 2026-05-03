import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import {
  Btn, Field, StyledInput, NumInput, Toggle, DateField, TimeField, SectionCard, ConfirmDialog,
} from './common';
import Dropdown from './Dropdown';
import ScreenContainer from './ScreenContainer';
import { computeShift } from '../utils/calculations';
import { parseTime, formatHM, formatMoney, clampNumber } from '../utils/helpers';
import { getActiveJobs, findJob } from '../utils/jobs';

export default function ShiftModal({ open, initial, isEdit, settings, onSave, onDelete, onClose }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [form, setForm] = useState(initial || {});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => { setForm(initial || {}); }, [initial]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.date &&
    form.start &&
    form.end &&
    parseTime(form.start) !== null &&
    parseTime(form.end) !== null;

  const c = valid ? computeShift(form, settings) : null;

  const activeJobs = getActiveJobs(settings.jobs || []);
  const showJobs = activeJobs.length > 0;
  const selectedJob = findJob(activeJobs, form.jobId);
  const jobHasTips = !!(selectedJob?.hasTips);

  const onJobChange = (jobId) => {
    const job = findJob(activeJobs, jobId);
    setForm((f) => ({
      ...f,
      jobId,
      // For new shifts, switching jobs auto-fills the rate from the new job.
      // For edits we leave the locked rate alone — historical pay shouldn't
      // change just because the user changed the job tag.
      hourlyRate: !isEdit && job ? job.hourlyRate : f.hourlyRate,
    }));
  };

  const save = () => {
    if (!valid) return;
    const tags = (typeof form._tagsText === 'string')
      ? form._tagsText.split(',').map((t) => t.trim()).filter(Boolean)
      : (form.tags || []);
    const out = { ...form, tags };
    delete out._tagsText;
    out.hourlyRate = clampNumber(out.hourlyRate);
    out.breakMinutes = clampNumber(out.breakMinutes, { max: 24 * 60 });
    out.overtimeMinutes = clampNumber(out.overtimeMinutes, { max: 24 * 60 });
    out.mileageKm = clampNumber(out.mileageKm, { max: 100_000 });
    out.tips = clampNumber(out.tips ?? 0, { max: 100_000 });
    out.breakPaid = !!out.breakPaid;
    onSave(out);
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <ScreenContainer>
        <View style={s.header}>
          <Pressable onPress={onClose} style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={C.textSubtle} />
          </Pressable>
          <Text style={s.title}>{isEdit ? 'Edit shift' : 'New shift'}</Text>
          <Btn variant="primary" onPress={save} disabled={!valid} small>Save</Btn>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {valid && c && (
            <View style={s.preview}>
              <View>
                <Text style={s.previewLabel}>PREVIEW</Text>
                <Text style={s.previewHours}>{formatHM(c.paidMinutes)}</Text>
              </View>
              {settings.showWage && (
                <Text style={s.previewPay}>{formatMoney(c.pay)}</Text>
              )}
            </View>
          )}

          <DateField label="Date" value={form.date || ''} onChange={(v) => set('date', v)} />

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <TimeField label="Start" value={form.start || ''} onChange={(v) => set('start', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="End" value={form.end || ''} onChange={(v) => set('end', v)} />
            </View>
          </View>

          {showJobs && (
            <Field label="Job">
              <Dropdown
                value={form.jobId || ''}
                options={activeJobs.map((j) => ({
                  value: j.id,
                  label: j.name,
                  sublabel: settings.showWage ? `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` : undefined,
                }))}
                onChange={onJobChange}
                placeholder="Select a job"
              />
            </Field>
          )}

          {settings.showWage && (
            <Field label="Hourly rate" hint="locked at creation">
              <NumInput
                value={form.hourlyRate ?? settings.defaultHourlyRate}
                onChangeText={(v) => set('hourlyRate', v)}
                placeholder="0.00"
              />
            </Field>
          )}

          {settings.showWage && jobHasTips && (
            <Field label="Tips earned">
              <NumInput
                value={form.tips ?? 0}
                onChangeText={(v) => set('tips', v)}
                placeholder="0.00"
              />
            </Field>
          )}

          {settings.trackBreaks && (
            <SectionCard style={{ gap: 4 }}>
              <Field label="Break (minutes)">
                <NumInput
                  value={form.breakMinutes ?? 0}
                  onChangeText={(v) => set('breakMinutes', v)}
                  placeholder="0"
                />
              </Field>
              <Toggle
                checked={!!form.breakPaid}
                onChange={(v) => set('breakPaid', v)}
                label="Paid break"
                hint="Don't deduct from paid hours"
              />
            </SectionCard>
          )}

          {settings.trackOvertime && (
            <Field label="Overtime (minutes)" hint={`× ${settings.overtimeMultiplier}`}>
              <NumInput
                value={form.overtimeMinutes ?? 0}
                onChangeText={(v) => set('overtimeMinutes', v)}
                placeholder="0"
              />
            </Field>
          )}

          {settings.trackMileage && (
            <Field label="Mileage (km)">
              <NumInput
                value={form.mileageKm ?? 0}
                onChangeText={(v) => set('mileageKm', v)}
                placeholder="0"
              />
            </Field>
          )}

          {settings.trackTags && (
            <Field label="Tags" hint="comma separated">
              <StyledInput
                placeholder="opening, closing"
                value={
                  form._tagsText !== undefined
                    ? form._tagsText
                    : (form.tags || []).join(', ')
                }
                onChangeText={(v) => set('_tagsText', v)}
              />
            </Field>
          )}

          <Field label="Notes">
            <StyledInput
              multiline
              rows={6}
              placeholder="What happened during this shift…"
              value={form.notes || ''}
              onChangeText={(v) => set('notes', v)}
            />
          </Field>

          {isEdit && (
            <Btn variant="danger" onPress={() => setDeleteConfirm(true)}>
              <Ionicons name="trash-outline" size={18} color={C.danger} />
              <Text style={s.deleteBtnText}>Delete shift</Text>
            </Btn>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete this shift?"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => { setDeleteConfirm(false); onDelete(form.id); }}
        onCancel={() => setDeleteConfirm(false)}
      />
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
    backgroundColor: C.bg,
  },
  closeBtn: { padding: 6 },
  title: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { padding: 16, gap: 14, paddingBottom: 40 },

  preview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: C.accentBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentBorder,
    padding: 16,
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    color: `${C.accentDim}cc`, marginBottom: 4,
  },
  previewHours: { fontSize: 26, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  previewPay: { fontSize: 20, fontWeight: '600', color: C.accentBright, fontVariant: ['tabular-nums'] },

  row2: { flexDirection: 'row', gap: 12 },

  deleteBtnText: { fontSize: 14, fontWeight: '600', color: C.danger },
});
