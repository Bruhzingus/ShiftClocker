import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn, Field, StyledInput, NumInput, Toggle, SectionCard, DateField } from './common';
import Dropdown from './Dropdown';
import { computeShift } from '../utils/calculations';
import { todayISO, formatHM, formatMoney, parseTime } from '../utils/helpers';
import { getActiveJobs, findJob, defaultJobId } from '../utils/jobs';

// ─── Quick Shift Confirm Modal ─────────────────────────────────────────────────

function QuickShiftConfirmModal({ open, quickShift, settings, defaultJob, onAdd, onClose }) {
  const C = useTheme();
  const m = useStyles(makeModalStyles);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [mileageKm, setMileageKm] = useState('0');
  const [tips, setTips] = useState('0');
  const [breakMinutes, setBreakMinutes] = useState(String(quickShift?.breakMinutes || 0));
  const [breakPaid, setBreakPaid] = useState(!!(quickShift?.breakPaid));
  const [jobId, setJobId] = useState(defaultJob?.id || '');

  const activeJobs = getActiveJobs(settings.jobs || []);

  useEffect(() => {
    setBreakMinutes(String(quickShift?.breakMinutes || 0));
    setBreakPaid(!!(quickShift?.breakPaid));
  }, [quickShift?.id]);

  useEffect(() => {
    if (open && defaultJob?.id) setJobId(defaultJob.id);
  }, [open, defaultJob?.id]);

  if (!quickShift) return null;

  const job = findJob(activeJobs, jobId);
  const rate = job ? job.hourlyRate : Number(quickShift.hourlyRate) || 0;
  const form = {
    ...quickShift, date, notes, jobId, hourlyRate: rate,
    mileageKm: Number(mileageKm) || 0,
    tips: Number(tips) || 0,
    breakMinutes: Number(breakMinutes) || 0, breakPaid,
  };
  const valid = parseTime(quickShift.start) !== null && parseTime(quickShift.end) !== null;
  const c = valid ? computeShift(form, settings) : null;

  const handleAdd = () => {
    onAdd({ ...form });
    setDate(todayISO()); setNotes(''); setMileageKm('0'); setTips('0');
    setBreakMinutes(String(quickShift.breakMinutes || 0));
    setBreakPaid(!!(quickShift.breakPaid));
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={m.backdrop} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.title} numberOfLines={1}>{quickShift.name}</Text>
              <Text style={m.subtitle}>
                {quickShift.start} → {quickShift.end}
                {settings.trackBreaks && (quickShift.breakMinutes || 0) > 0
                  ? `  ·  ${quickShift.breakMinutes}m break` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Ionicons name="close" size={22} color={C.textSubtle} />
            </Pressable>
          </View>

          {c && (
            <View style={m.preview}>
              <Text style={m.previewHours}>{formatHM(c.paidMinutes)}</Text>
              {settings.showWage && <Text style={m.previewPay}>{formatMoney(c.pay)}</Text>}
            </View>
          )}

          <ScrollView style={m.body} keyboardShouldPersistTaps="handled">
            <DateField label="Date" value={date} onChange={setDate} />

            {activeJobs.length > 0 && (
              <>
                <View style={{ height: 12 }} />
                <Field label="Job" hint={settings.showWage ? `$${rate.toFixed(2)}/hr` : undefined}>
                  <Dropdown
                    value={jobId}
                    options={activeJobs.map((j) => ({
                      value: j.id, label: j.name,
                      sublabel: settings.showWage ? `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` : undefined,
                    }))}
                    onChange={setJobId}
                    placeholder="Select a job"
                  />
                </Field>
              </>
            )}

            {settings.showWage && job?.hasTips && (
              <>
                <View style={{ height: 12 }} />
                <Field label="Tips earned">
                  <StyledInput keyboardType="decimal-pad" placeholder="0.00" value={tips} onChangeText={setTips} />
                </Field>
              </>
            )}

            <View style={{ height: 12 }} />
            <Field label="Notes" hint="optional">
              <StyledInput multiline rows={3} placeholder="Any notes for this shift…" value={notes} onChangeText={setNotes} />
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
                  <StyledInput keyboardType="decimal-pad" placeholder="0" value={mileageKm} onChangeText={setMileageKm} />
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Quick Shift Bar ──────────────────────────────────────────────────────────

export default function QuickShiftBar({ quickShifts, settings, onAdd, onNewShift }) {
  const C = useTheme();
  const s = useStyles(makeBarStyles);
  const [pickedId, setPickedId] = useState(quickShifts[0]?.id || '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selected = quickShifts.find((q) => q.id === pickedId) || quickShifts[0] || null;
  const activeJobs = getActiveJobs(settings.jobs || []);
  const defaultJob = findJob(activeJobs, defaultJobId(activeJobs, settings.lastUsedJobId));

  const handleQuickAdd = () => { if (selected) setConfirmOpen(true); };

  const options = quickShifts.map((q) => ({
    value: q.id, label: q.name, sublabel: `${q.start} – ${q.end}`,
  }));

  return (
    <View>
      <View style={s.bar}>
        {quickShifts.length > 0 ? (
          <Dropdown
            value={pickedId}
            options={options}
            onChange={setPickedId}
            style={s.pickerWrap}
          />
        ) : (
          <View style={s.pickerWrap}>
            <Text style={s.emptyLabel}>No quick shifts</Text>
          </View>
        )}

        {/* Quick Add — only when templates exist */}
        {quickShifts.length > 0 && (
          <Pressable
            onPress={handleQuickAdd}
            disabled={!selected}
            accessibilityRole="button"
            accessibilityLabel="Add quick shift"
            style={({ pressed }) => [
              s.quickBtn,
              !selected && { opacity: 0.4 },
              pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons name="flash" size={16} color={C.accentInk} />
            <Text style={s.quickBtnText}>Quick Add</Text>
          </Pressable>
        )}

        {/* New custom shift — always visible, distinct color */}
        <Pressable
          onPress={onNewShift}
          accessibilityRole="button"
          accessibilityLabel="Create new shift"
          style={({ pressed }) => [
            s.newBtn,
            pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons name="add" size={17} color={C.green} />
          <Text style={s.newBtnText}>New</Text>
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
  emptyLabel: { fontSize: 13, color: C.textFaint, paddingHorizontal: 8 },

  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 13, height: 44,
  },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: C.accentInk },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.surfaceHov, borderRadius: 10,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: C.green,
  },
  newBtnText: { fontSize: 13, fontWeight: '700', color: C.green },
});

const makeModalStyles = (C) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: Platform.OS === 'android' ? 28 : 0 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: C.border, maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.surfaceHov,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint, gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.textFaint, marginTop: 3, fontVariant: ['tabular-nums'] },
  preview: {
    flexDirection: 'row', alignItems: 'baseline', gap: 16,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: C.accentBg, borderBottomWidth: 1, borderBottomColor: C.accentBorder,
  },
  previewHours: { fontSize: 22, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  previewPay: { fontSize: 18, fontWeight: '600', color: C.accentBright, fontVariant: ['tabular-nums'] },
  body: { padding: 20 },
  actions: { flexDirection: 'row', gap: 8 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
});
