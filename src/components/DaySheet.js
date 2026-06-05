import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn } from './common';
import { computeShift } from '../utils/calculations';
import { formatDateMed, formatHM, formatMoney } from '../utils/helpers';
import { findJob } from '../utils/jobs';

// Bottom sheet listing a single day's shifts (from the calendar). Tap a shift to
// edit; or add a new shift prefilled to that date.
export default function DaySheet({ dateISO, shifts, settings, onEdit, onAddForDay, onClose }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  if (!dateISO) return null;

  const dayShifts = shifts
    .filter((sh) => sh.date === dateISO)
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  let mins = 0, pay = 0;
  for (const sh of dayShifts) { const c = computeShift(sh, settings); mins += c.paidMinutes; pay += c.pay; }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{formatDateMed(dateISO)}</Text>
              <Text style={s.subtitle}>
                {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} · {formatHM(mins)}
                {settings.showWage ? ` · ${formatMoney(pay)}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.textSubtle} />
            </Pressable>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            {dayShifts.length === 0 ? (
              <Text style={s.empty}>No shifts on this day.</Text>
            ) : dayShifts.map((sh) => {
              const c = computeShift(sh, settings);
              const job = sh.jobId ? findJob(settings.jobs, sh.jobId) : null;
              return (
                <Pressable key={sh.id} onPress={() => onEdit(sh)}
                  style={({ pressed }) => [s.row, pressed && { backgroundColor: C.surfaceHov }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTime}>{sh.start}–{sh.end} · {formatHM(c.paidMinutes)}</Text>
                    {!!sh.notes && <Text style={s.rowNotes} numberOfLines={1}>{sh.notes}</Text>}
                    {job && (
                      <View style={s.jobChip}>
                        <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
                        <Text style={s.jobName}>{job.name}</Text>
                      </View>
                    )}
                  </View>
                  {settings.showWage && <Text style={s.rowPay}>{formatMoney(c.pay)}</Text>}
                  <Ionicons name="chevron-forward" size={16} color={C.textDim} />
                </Pressable>
              );
            })}
            <View style={{ height: 14 }} />
            <Btn variant="primary" onPress={() => onAddForDay(dateISO)}>
              <Ionicons name="add" size={18} color={C.accentInk} />
              <Text style={s.addText}>Add shift this day</Text>
            </Btn>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: C.border, maxHeight: '80%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.surfaceHov, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 12, color: C.textFaint, marginTop: 3, fontVariant: ['tabular-nums'] },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  empty: { fontSize: 13, color: C.textFaint, textAlign: 'center', paddingVertical: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.borderFaint,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  rowTime: { fontSize: 14, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  rowNotes: { fontSize: 12, color: C.textFaint, marginTop: 2 },
  rowPay: { fontSize: 14, fontWeight: '600', color: C.accentBright, fontVariant: ['tabular-nums'] },
  jobChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  jobDot: { width: 7, height: 7, borderRadius: 3.5 },
  jobName: { fontSize: 11, color: C.textSubtle, fontWeight: '500' },
  addText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
});
