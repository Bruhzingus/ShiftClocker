import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn, Field, StyledInput, NumInput, Toggle, SectionCard, DateField } from './common';
import Dropdown from './Dropdown';
import { computeShift } from '../utils/calculations';
import { todayISO, formatHM, formatMoney, parseTime } from '../utils/helpers';
import { getActiveJobs, findJob, defaultJobId } from '../utils/jobs';

// ─── Quick Shift Confirm Modal ────────────────────────────────────────────────

function QuickShiftConfirmModal({ open, quickShift, settings, defaultJob, onAdd, onClose }) {
  const C = useTheme();
  const m = useStyles(makeModalStyles);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [mileageKm, setMileageKm] = useState('0');
  const [breakMinutes, setBreakMinutes] = useState(String(quickShift?.breakMinutes || 0));
  const [breakPaid, setBreakPaid] = useState(!!(quickShift?.breakPaid));
  const [jobId, setJobId] = useState(defaultJob?.id || '');

  const activeJobs = getActiveJobs(settings.jobs || []);

  // Reset per-shift state when the user picks a different quick shift template.
  useEffect(() => {
    setBreakMinutes(String(quickShift?.breakMinutes || 0));
    setBreakPaid(!!(quickShift?.breakPaid));
  }, [quickShift?.id]);

  // Re-sync the default job whenever the modal is opened so the most-recent
  // job stays at the top of the picker even if it changed since last time.
  useEffect(() => {
    if (open && defaultJob?.id) setJobId(defaultJob.id);
  }, [open, defaultJob?.id]);

  if (!quickShift) return null;

  const job = findJob(activeJobs, jobId);
  // Job rate trumps the template's stored rate so wage changes show up
  // immediately without editing every quick shift template.
  const rate = job ? job.hourlyRate : Number(quickShift.hourlyRate) || 0;

  const form = {
    ...quickShift,
    date,
    notes,
    jobId,
    hourlyRate: rate,
    mileageKm: Number(mileageKm) || 0,
    breakMinutes: Number(breakMinutes) || 0,
    breakPaid,
  };
  const valid = parseTime(quickShift.start) !== null && parseTime(quickShift.end) !== null;
  const c = valid ? computeShift(form, settings) : null;

  const handleAdd = () => {
    onAdd({ ...form });
    setDate(todayISO());
    setNotes('');
    setMileageKm('0');
    setBreakMinutes(String(quickShift.breakMinutes || 0));
    setBreakPaid(!!(quickShift.breakPaid));
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <Pressable style={m.backdrop} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />

          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.title} numberOfLines={1}>{quickShift.name}</Text>
              <Text style={m.subtitle}>
                {quickShift.start} → {quickShift.end}
                {settings.trackBreaks && (quickShift.breakMinutes || 0) > 0
                  ? `  ·  ${quickShift.breakMinutes}m break`
                  : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.textSubtle} />
            </Pressable>
          </View>

          {c && (
            <View style={m.preview}>
              <Text style={m.previewHours}>{formatHM(c.paidMinutes)}</Text>
              {settings.showWage && (
                <Text style={m.previewPay}>{formatMoney(c.pay)}</Text>
              )}
            </View>
          )}

          <ScrollView style={m.body} keyboardShouldPersistTaps="handled">
            <DateField label="Date" value={date} onChange={setDate} />

            {activeJobs.length > 0 && (
              <>
                <View style={{ height: 12 }} />
                <Field
                  label="Job"
                  hint={settings.showWage ? `$${rate.toFixed(2)}/hr` : undefined}
                >
                  <Dropdown
                    value={jobId}
                    options={activeJobs.map((j) => ({
                      value: j.id,
                      label: j.name,
                      sublabel: settings.showWage ? `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` : undefined,
                    }))}
                    onChange={setJobId}
                    placeholder="Select a job"
                  />
                </Field>
              </>
            )}

            <View style={{ height: 12 }} />

            <Field label="Notes" hint="optional">
              <StyledInput
                multiline
                rows={4}
                placeholder="Any notes for this shift…"
                value={notes}
                onChangeText={setNotes}
              />
            </Field>

            <View style={{ height: 12 }} />
            <SectionCard style={{ gap: 4 }}>
              <Field label="Break (minutes)">
                <NumInput value={breakMinutes} onChangeText={setBreakMinutes} />
              </Field>
              <Toggle checked={breakPaid} onChange={setBreakPaid} label="Paid break" />
            </SectionCard>

            {settings.trackMileage && (
              <>
                <View style={{ height: 12 }} />
                <Field label="Mileage (km)" hint="optional">
                  <StyledInput
                    keyboardType="decimal-pad"
                    placeholder="0"
                    value={mileageKm}
                    onChangeText={setMileageKm}
                  />
                </Field>
              </>
            )}

            <View style={{ height: 20 }} />

            <View style={m.actions}>
              <Btn variant="ghost" onPress={onClose} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onPress={handleAdd} style={{ flex: 1 }}>
                <Ionicons name="add" size={18} color={C.accentInk} />
                <Text style={m.addBtnText}>Add Shift</Text>
              </Btn>
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Quick Shift Bar ──────────────────────────────────────────────────────────

export default function QuickShiftBar({ quickShifts, settings, onAdd, onManage }) {
  const C = useTheme();
  const s = useStyles(makeBarStyles);
  const [pickedId, setPickedId] = useState(quickShifts[0]?.id || '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = quickShifts.find((q) => q.id === pickedId) || quickShifts[0] || null;
  const activeJobs = getActiveJobs(settings.jobs || []);
  const defaultJob = findJob(activeJobs, defaultJobId(activeJobs, settings.lastUsedJobId));

  const handleAdd = () => {
    if (selected) setConfirmOpen(true);
  };

  if (quickShifts.length === 0) {
    return (
      <View style={s.emptyBar}>
        <Text style={s.emptyText}>No quick shifts yet.</Text>
        <Btn variant="ghost" onPress={onManage} small>
          <Ionicons name="add" size={16} color={C.accent} />
          <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Create one</Text>
        </Btn>
      </View>
    );
  }

  const options = quickShifts.map((q) => ({
    value: q.id,
    label: q.name,
    sublabel: `${q.start} – ${q.end}`,
  }));

  return (
    <View>
      <View style={s.bar}>
        <Dropdown
          value={pickedId}
          options={options}
          onChange={setPickedId}
          style={s.pickerWrap}
        />

        <Pressable
          onPress={handleAdd}
          disabled={!selected}
          accessibilityRole="button"
          accessibilityLabel="Add quick shift"
          style={({ pressed }) => [
            s.addBtn,
            !selected && { opacity: 0.4 },
            pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name="add" size={20} color={C.accentInk} />
          <Text style={s.addText}>Add</Text>
        </Pressable>

        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel="Manage quick shifts"
          style={({ pressed }) => [s.manageBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="options-outline" size={20} color={C.textSubtle} />
        </Pressable>
      </View>

      <QuickShiftConfirmModal
        open={confirmOpen}
        quickShift={selected}
        settings={settings}
        defaultJob={defaultJob}
        onAdd={onAdd}
        onClose={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const makeBarStyles = (C) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderFaint,
    padding: 8,
  },
  pickerWrap: { flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  addText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
  manageBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },

  emptyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderFaint,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyText: { fontSize: 13, color: C.textFaint },
});

const makeModalStyles = (C) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.surfaceHov,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.textFaint, marginTop: 3, fontVariant: ['tabular-nums'] },
  preview: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.accentBg,
    borderBottomWidth: 1,
    borderBottomColor: C.accentBorder,
  },
  previewHours: { fontSize: 22, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  previewPay: { fontSize: 18, fontWeight: '600', color: C.accentBright, fontVariant: ['tabular-nums'] },
  body: { padding: 20 },
  actions: { flexDirection: 'row', gap: 8 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
});
