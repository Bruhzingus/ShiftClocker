import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import {
  Btn, Field, StyledInput, NumInput, Toggle, TimeField, SectionCard, ConfirmDialog,
} from '../components/common';
import Dropdown from '../components/Dropdown';
import ScreenContainer from '../components/ScreenContainer';
import { FadeIn } from '../components/Animated';
import { uid } from '../utils/helpers';
import { getActiveJobs, findJob } from '../utils/jobs';

function QuickShiftEditor({ template, settings, onSave, onClose }) {
  const C = useTheme();
  const e = useStyles(makeEditorStyles);
  const [form, setForm] = useState(template || {});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid = form.name && form.name.trim() && form.start && form.end;
  const activeJobs = getActiveJobs(settings.jobs || []);

  const save = () => {
    if (!valid) return;
    const tags = (typeof form._tagsText === 'string')
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
          <Text style={e.title}>Quick shift</Text>
          <Btn variant="primary" onPress={save} disabled={!valid} small>Save</Btn>
        </View>
        <ScrollView style={e.body} keyboardShouldPersistTaps="handled">
          <Field label="Name">
            <StyledInput
              value={form.name || ''}
              onChangeText={(v) => set('name', v)}
              placeholder="e.g. Day 8h"
              maxLength={40}
            />
          </Field>
          <View style={{ height: 12 }} />
          <View style={e.row2}>
            <View style={{ flex: 1 }}>
              <TimeField label="Start" value={form.start || ''} onChange={(v) => set('start', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeField label="End" value={form.end || ''} onChange={(v) => set('end', v)} />
            </View>
          </View>

          {activeJobs.length > 0 && (
            <>
              <View style={{ height: 12 }} />
              <Field label="Default job" hint="optional — pre-selects when adding from this template">
                <Dropdown
                  value={form.defaultJobId || ''}
                  options={[
                    { value: '', label: 'No default (use last-used job)' },
                    ...activeJobs.map((j) => ({
                      value: j.id,
                      label: j.name,
                      sublabel: settings.showWage ? `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` : undefined,
                    })),
                  ]}
                  onChange={(v) => set('defaultJobId', v)}
                  placeholder="No default"
                />
              </Field>
            </>
          )}

          {settings.showWage && (
            <>
              <View style={{ height: 12 }} />
              <Field label="Fallback hourly rate" hint="used when no job is set">
                <NumInput value={form.hourlyRate ?? settings.defaultHourlyRate} onChangeText={(v) => set('hourlyRate', v)} />
              </Field>
            </>
          )}

          <View style={{ height: 12 }} />
          <SectionCard style={{ gap: 4 }}>
            <Field label="Break (minutes)">
              <NumInput value={form.breakMinutes ?? 0} onChangeText={(v) => set('breakMinutes', v)} />
            </Field>
            <Toggle checked={!!form.breakPaid} onChange={(v) => set('breakPaid', v)} label="Paid break" />
          </SectionCard>

          {settings.trackOvertime && (
            <>
              <View style={{ height: 12 }} />
              <Field label="Overtime (minutes)">
                <NumInput value={form.overtimeMinutes ?? 0} onChangeText={(v) => set('overtimeMinutes', v)} />
              </Field>
            </>
          )}

          {settings.trackTags && (
            <>
              <View style={{ height: 12 }} />
              <Field label="Tags" hint="comma separated">
                <StyledInput
                  value={
                    form._tagsText !== undefined
                      ? form._tagsText
                      : (form.tags || []).join(', ')
                  }
                  onChangeText={(v) => set('_tagsText', v)}
                  placeholder="opening, training"
                />
              </Field>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}

export default function QuickShiftsScreen({ quickShifts, setQuickShifts, settings, onBack }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const startNew = () =>
    setEditing({
      id: uid(), name: '', start: '09:00', end: '17:00',
      hourlyRate: settings.defaultHourlyRate, breakMinutes: 30,
      breakPaid: false, overtimeMinutes: 0, tags: [],
    });

  const startEdit = (q) => setEditing({ ...q, _tagsText: (q.tags || []).join(', ') });

  const save = (out) => {
    const exists = quickShifts.find((q) => q.id === out.id);
    setQuickShifts(
      exists ? quickShifts.map((q) => (q.id === out.id ? out : q)) : [...quickShifts, out]
    );
    setEditing(null);
  };

  const remove = (id) => {
    setQuickShifts(quickShifts.filter((q) => q.id !== id));
    setDeleteTarget(null);
  };

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
        </Pressable>
        <Text style={s.title}>Quick shifts</Text>
        <Btn variant="primary" onPress={startNew} small>
          <Ionicons name="add" size={18} color={C.accentInk} />
          <Text style={s.newBtnText}>New</Text>
        </Btn>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ padding: 16 }}>
        {quickShifts.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="flash-outline" size={36} color={C.textDim} />
            <Text style={s.emptyText}>No quick shifts yet.</Text>
            <Text style={s.emptyHint}>Create a template to add shifts faster.</Text>
          </View>
        ) : (
          quickShifts.map((q, i) => {
            const job = q.defaultJobId ? findJob(settings.jobs, q.defaultJobId) : null;
            return (
              <FadeIn key={q.id} delay={i * 40}>
                <Pressable onPress={() => startEdit(q)} style={({ pressed }) => [s.card, pressed && { backgroundColor: C.surfaceHov }]} accessibilityRole="button">
                  <View style={s.cardMain}>
                    <Text style={s.cardName}>{q.name}</Text>
                    <Text style={s.cardMeta}>
                      {q.start} → {q.end}
                      {settings.showWage ? `  ·  $${(Number(q.hourlyRate) || 0).toFixed(2)}/h` : ''}
                      {settings.trackBreaks && (q.breakMinutes || 0) > 0
                        ? `  ·  ${q.breakMinutes}m break${q.breakPaid ? ' (paid)' : ''}`
                        : ''}
                    </Text>
                    {job && (
                      <View style={s.jobChip}>
                        <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
                        <Text style={s.jobChipText}>{job.name}</Text>
                      </View>
                    )}
                    {settings.trackTags && q.tags && q.tags.length > 0 && (
                      <View style={s.tagsRow}>
                        {q.tags.map((t) => (
                          <Text key={t} style={s.tag}>#{t}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={s.cardActions}>
                    <Pressable
                      onPress={() => startEdit(q)}
                      style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Edit quick shift"
                    >
                      <Ionicons name="pencil-outline" size={18} color={C.textFaint} />
                    </Pressable>
                    <Pressable
                      onPress={() => setDeleteTarget(q.id)}
                      style={({ pressed }) => [s.actionBtn, s.actionDanger, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Delete quick shift"
                    >
                      <Ionicons name="trash-outline" size={18} color={C.danger} />
                    </Pressable>
                  </View>
                </Pressable>
              </FadeIn>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {editing && (
        <QuickShiftEditor
          template={editing}
          settings={settings}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete quick shift?"
        message="This only removes the template, not any shifts already added."
        confirmLabel="Delete"
        danger
        onConfirm={() => remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenContainer>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingRight: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },
  newBtnText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
  body: { flex: 1 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, color: C.textMuted, fontWeight: '500', marginTop: 4 },
  emptyHint: { fontSize: 13, color: C.textFaint },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderFaint,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardMain: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '600', color: C.text },
  cardMeta: { fontSize: 12, color: C.textFaint, fontVariant: ['tabular-nums'] },
  jobChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 4,
  },
  jobDot: { width: 8, height: 8, borderRadius: 4 },
  jobChipText: { fontSize: 11, color: C.textSubtle, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  tag: {
    fontSize: 10, color: C.textFaint,
    backgroundColor: C.surfaceHov,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionDanger: { borderColor: C.dangerBorder, backgroundColor: C.dangerBg },
});

const makeEditorStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text },
  body: { flex: 1, padding: 16 },
  row2: { flexDirection: 'row', gap: 12 },
});
