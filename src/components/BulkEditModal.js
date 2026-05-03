import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn, Field, StyledInput, NumInput, Toggle } from './common';
import Dropdown from './Dropdown';
import { getActiveJobs } from '../utils/jobs';

export default function BulkEditModal({ open, count, settings, onSave, onClose }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [notesMode, setNotesMode] = useState('append');
  const [notes, setNotes] = useState('');
  const [applyRate, setApplyRate] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [applyTags, setApplyTags] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [applyJob, setApplyJob] = useState(false);
  const [jobId, setJobId] = useState('');

  const activeJobs = getActiveJobs(settings.jobs || []);

  const reset = () => {
    setNotesMode('append');
    setNotes('');
    setApplyRate(false);
    setHourlyRate('');
    setApplyTags(false);
    setTagsText('');
    setApplyJob(false);
    setJobId('');
  };

  const save = () => {
    const patch = {};
    if (notesMode !== 'skip' && notes.trim()) {
      patch.notes = notes.trim();
      patch.notesMode = notesMode;
    }
    if (applyRate && hourlyRate) patch.hourlyRate = Number(hourlyRate) || 0;
    if (applyTags) {
      patch.tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (applyJob && jobId) patch.jobId = jobId;
    onSave(patch);
    reset();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>Edit {count} shift{count !== 1 ? 's' : ''}</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.textSubtle} /></Pressable>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.sectionLabel}>NOTES</Text>
            <View style={s.segmented}>
              {['append', 'replace', 'skip'].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setNotesMode(m)}
                  style={[s.segment, notesMode === m && s.segmentActive]}
                >
                  <Text style={[s.segmentText, notesMode === m && s.segmentTextActive]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {notesMode !== 'skip' && (
              <StyledInput
                multiline
                rows={3}
                placeholder={notesMode === 'append' ? 'Text to append to all notes…' : 'Replace all notes with…'}
                value={notes}
                onChangeText={setNotes}
                style={{ marginTop: 8 }}
              />
            )}

            <View style={s.spacer} />

            {settings.showWage && (
              <View>
                <Toggle checked={applyRate} onChange={setApplyRate} label="Override hourly rate" />
                {applyRate && (
                  <Field label="Rate ($/hr)">
                    <NumInput value={hourlyRate} onChangeText={setHourlyRate} placeholder="0.00" />
                  </Field>
                )}
              </View>
            )}

            {activeJobs.length > 0 && (
              <View>
                <Toggle checked={applyJob} onChange={setApplyJob} label="Reassign to job" hint="Tags every selected shift with the chosen job" />
                {applyJob && (
                  <Field label="Job">
                    <Dropdown
                      value={jobId}
                      options={activeJobs.map((j) => ({ value: j.id, label: j.name, sublabel: `$${(Number(j.hourlyRate) || 0).toFixed(2)}/hr` }))}
                      onChange={setJobId}
                      placeholder="Select a job"
                    />
                  </Field>
                )}
              </View>
            )}

            {settings.trackTags && (
              <View>
                <Toggle checked={applyTags} onChange={setApplyTags} label="Apply tags" hint="Replaces existing tags" />
                {applyTags && (
                  <Field label="Tags" hint="comma separated">
                    <StyledInput value={tagsText} onChangeText={setTagsText} placeholder="opening, training" />
                  </Field>
                )}
              </View>
            )}

            <View style={{ height: 16 }} />

            <View style={s.actions}>
              <Btn variant="ghost" onPress={onClose} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onPress={save} style={{ flex: 1 }}>Apply</Btn>
            </View>
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
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: '80%',
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
  },
  title: { fontSize: 16, fontWeight: '700', color: C.text },
  body: { padding: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: C.textFaint, marginBottom: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8,
  },
  segmentActive: { backgroundColor: C.accentBg },
  segmentText: { fontSize: 13, color: C.textFaint, fontWeight: '500' },
  segmentTextActive: { color: C.text },
  spacer: { height: 16 },
  actions: { flexDirection: 'row', gap: 8 },
});
