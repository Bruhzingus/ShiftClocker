import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn, ConfirmDialog } from './common';
import { computeShift } from '../utils/calculations';
import { formatDateMed, formatHM, formatMoney } from '../utils/helpers';
import { findJob } from '../utils/jobs';
import BulkEditModal from './BulkEditModal';

const W = {
  check: 40,
  date: 96,
  times: 124,
  hours: 66,
  pay: 80,
  break: 68,
  ot: 68,
  job: 96,
  notes: 220,
};

function tableWidth(settings, selectionMode, hasJobs) {
  let w = W.date + W.times + W.hours + W.notes;
  if (selectionMode) w += W.check;
  if (settings.showWage) w += W.pay;
  if (settings.trackBreaks) w += W.break;
  if (settings.trackOvertime) w += W.ot;
  if (hasJobs) w += W.job;
  return w;
}

function TableHeader({ settings, selectionMode, allSelected, onSelectAll, hasJobs }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <View style={s.headerRow}>
      {selectionMode && (
        <Pressable style={[s.cell, { width: W.check }]} onPress={onSelectAll}>
          <Ionicons
            name={allSelected ? 'checkbox' : 'square-outline'}
            size={20}
            color={allSelected ? C.accent : C.textFaint}
          />
        </Pressable>
      )}
      <Text style={[s.headerCell, { width: W.date }]}>DATE</Text>
      <Text style={[s.headerCell, { width: W.times }]}>TIMES</Text>
      <Text style={[s.headerCell, { width: W.hours }]}>HRS</Text>
      {settings.trackBreaks && <Text style={[s.headerCell, { width: W.break }]}>BREAK</Text>}
      {settings.trackOvertime && <Text style={[s.headerCell, { width: W.ot }]}>OT</Text>}
      {settings.showWage && <Text style={[s.headerCell, { width: W.pay }]}>PAY</Text>}
      {hasJobs && <Text style={[s.headerCell, { width: W.job }]}>JOB</Text>}
      <Text style={[s.headerCell, { flex: 1, width: W.notes }]}>NOTES</Text>
    </View>
  );
}

function ShiftRow({ shift, settings, selectionMode, selected, onPress, onLongPress, index, hasJobs }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesTruncatable, setNotesTruncatable] = useState(false);
  const c = computeShift(shift, settings);
  const breakText = (shift.breakMinutes || 0) > 0
    ? `${shift.breakMinutes}m${shift.breakPaid ? '✓' : ''}`
    : '—';
  const otText = (shift.overtimeMinutes || 0) > 0
    ? formatHM(Number(shift.overtimeMinutes))
    : '—';
  const hasNotes = !!shift.notes;
  const isAlt = index % 2 === 1;
  const job = hasJobs ? findJob(settings.jobs, shift.jobId) : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        s.row,
        isAlt && s.rowAlt,
        selected && s.rowSelected,
        pressed && s.rowPressed,
      ]}
    >
      {selectionMode && (
        <View style={[s.cell, { width: W.check }]}>
          <Ionicons
            name={selected ? 'checkbox' : 'square-outline'}
            size={20}
            color={selected ? C.accent : C.textFaint}
          />
        </View>
      )}

      <View style={[s.cell, { width: W.date }]}>
        <Text style={s.cellDateText} numberOfLines={2}>
          {formatDateMed(shift.date)}
        </Text>
      </View>

      <View style={[s.cell, { width: W.times }]}>
        <Text style={s.cellMono} numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit>{shift.start}</Text>
        <Text style={s.cellArrow} numberOfLines={1} adjustsFontSizeToFit>→ {shift.end}</Text>
      </View>

      <View style={[s.cell, { width: W.hours }]}>
        <Text style={s.cellMono}>{formatHM(c.paidMinutes)}</Text>
      </View>

      {settings.trackBreaks && (
        <View style={[s.cell, { width: W.break }]}>
          <Text style={s.cellSubtle}>{breakText}</Text>
        </View>
      )}

      {settings.trackOvertime && (
        <View style={[s.cell, { width: W.ot }]}>
          <Text style={[s.cellSubtle, (shift.overtimeMinutes || 0) > 0 && s.cellAccent]}>
            {otText}
          </Text>
        </View>
      )}

      {settings.showWage && (
        <View style={[s.cell, { width: W.pay }]}>
          <Text style={s.cellPay}>{formatMoney(c.pay)}</Text>
        </View>
      )}

      {hasJobs && (
        <View style={[s.cell, { width: W.job }]}>
          {job ? (
            <View style={s.jobChip}>
              <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
              <Text style={s.jobChipText} numberOfLines={1}>{job.name}</Text>
            </View>
          ) : (
            <Text style={s.cellSubtle}>—</Text>
          )}
        </View>
      )}

      <Pressable
        style={[s.cell, s.notesCell, { width: W.notes }]}
        onPress={hasNotes && notesTruncatable ? () => setNotesExpanded((v) => !v) : undefined}
      >
        {hasNotes ? (
          <>
            <View style={s.notesMeasure}>
              <Text
                style={s.notesText}
                onTextLayout={(e) => setNotesTruncatable(e.nativeEvent.lines.length > 1)}
              >
                {shift.notes}
              </Text>
            </View>
            <View style={s.notesRow}>
              <Text style={[s.notesText, s.notesFlexText]} numberOfLines={notesExpanded ? undefined : 1}>
                {shift.notes}
              </Text>
              {notesTruncatable && (
                <Ionicons
                  name={notesExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={C.textFaint}
                  style={s.notesChevron}
                />
              )}
            </View>
          </>
        ) : (
          <Text style={s.notesEmpty}>—</Text>
        )}
        {settings.trackTags && shift.tags && shift.tags.length > 0 && (
          <View style={s.tagsRow}>
            {shift.tags.map((t) => (
              <Text key={t} style={s.tag}>#{t}</Text>
            ))}
          </View>
        )}
        {settings.trackMileage && (shift.mileageKm || 0) > 0 && (
          <Text style={s.mileageText}>
            <Ionicons name="car-outline" size={11} color={C.textFaint} /> {shift.mileageKm} km
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

function SelectionToolbar({ count, onDelete, onEdit, onCancel }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <View style={s.toolbar}>
      <Pressable onPress={onCancel} style={s.toolbarCancel}>
        <Ionicons name="close" size={22} color={C.textSubtle} />
      </Pressable>
      <Text style={s.toolbarCount}>{count} selected</Text>
      <View style={s.toolbarActions}>
        {count > 0 && (
          <>
            <Btn variant="ghost" onPress={onEdit} small>
              <Ionicons name="pencil-outline" size={16} color={C.textSubtle} />
              <Text style={s.toolbarBtnText}>Edit</Text>
            </Btn>
            <Btn variant="danger" onPress={onDelete} small>
              <Ionicons name="trash-outline" size={16} color={C.danger} />
              <Text style={[s.toolbarBtnText, { color: C.danger }]}>Delete</Text>
            </Btn>
          </>
        )}
      </View>
    </View>
  );
}

export default function ShiftTable({ shifts, settings, onEdit, onDeleteShifts, onBulkEdit }) {
  const s = useStyles(makeStyles);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const enterSelection = useCallback((id) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = shifts.length > 0 && selectedIds.size === shifts.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(shifts.map((sh) => sh.id)));
  };

  const handleRowPress = (shift) => {
    if (selectionMode) toggleSelect(shift.id);
    else onEdit(shift);
  };

  const handleDelete = () => {
    onDeleteShifts([...selectedIds]);
    exitSelection();
    setDeleteConfirm(false);
  };

  const handleBulkEdit = (patch) => {
    onBulkEdit([...selectedIds], patch);
    exitSelection();
    setBulkEditOpen(false);
  };

  const hasJobs = Array.isArray(settings.jobs) && settings.jobs.length > 0;
  const tWidth = tableWidth(settings, selectionMode, hasJobs);

  if (shifts.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>No shifts match your filters.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {selectionMode && (
        <SelectionToolbar
          count={selectedIds.size}
          onCancel={exitSelection}
          onDelete={() => setDeleteConfirm(true)}
          onEdit={() => setBulkEditOpen(true)}
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nestedScrollEnabled
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ width: Math.max(tWidth, 320), flex: 1 }}>
          <TableHeader
            settings={settings}
            selectionMode={selectionMode}
            allSelected={allSelected}
            onSelectAll={toggleSelectAll}
            hasJobs={hasJobs}
          />
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {shifts.map((shift, idx) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                settings={settings}
                selectionMode={selectionMode}
                selected={selectedIds.has(shift.id)}
                index={idx}
                onPress={() => handleRowPress(shift)}
                onLongPress={() => {
                  if (!selectionMode) enterSelection(shift.id);
                }}
                hasJobs={hasJobs}
              />
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </ScrollView>

      <ConfirmDialog
        open={deleteConfirm}
        title={`Delete ${selectedIds.size} shift${selectedIds.size !== 1 ? 's' : ''}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />

      <BulkEditModal
        open={bulkEditOpen}
        count={selectedIds.size}
        settings={settings}
        onSave={handleBulkEdit}
        onClose={() => setBulkEditOpen(false)}
      />
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.textFaint,
    paddingHorizontal: 6,
  },

  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
    paddingHorizontal: 4,
    backgroundColor: C.bg,
  },
  rowAlt: { backgroundColor: C.surfaceAlt },
  rowSelected: { backgroundColor: C.accentBg },
  rowPressed: { backgroundColor: C.surfaceHov },

  cell: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: 'flex-start',
  },
  notesCell: { flex: 1 },

  cellDateText: { fontSize: 13, color: C.textMuted, lineHeight: 18, fontWeight: '500' },
  cellMono: { fontSize: 14, color: C.text, fontWeight: '500', fontVariant: ['tabular-nums'] },
  cellArrow: { fontSize: 13, color: C.textSubtle, marginTop: 2, fontVariant: ['tabular-nums'] },
  cellSubtle: { fontSize: 13, color: C.textFaint, fontVariant: ['tabular-nums'] },
  cellAccent: { color: C.accentBright },
  cellPay: { fontSize: 14, color: C.accentBright, fontWeight: '600', fontVariant: ['tabular-nums'] },

  jobChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  jobDot: { width: 8, height: 8, borderRadius: 4 },
  jobChipText: { fontSize: 12, color: C.textMuted, fontWeight: '500', flexShrink: 1 },

  notesMeasure: { height: 0, overflow: 'hidden' },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  notesFlexText: { flex: 1 },
  notesChevron: { marginLeft: 4, marginTop: 2 },
  notesText: { fontSize: 13, color: C.textSubtle, lineHeight: 18 },
  notesEmpty: { fontSize: 13, color: C.textDim },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { fontSize: 11, color: C.textFaint, backgroundColor: C.surfaceHov, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  mileageText: { fontSize: 11, color: C.textFaint, marginTop: 3 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  toolbarCancel: { padding: 4 },
  toolbarCount: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  toolbarBtnText: { fontSize: 13, fontWeight: '500', color: C.textSubtle },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 14, color: C.textFaint },
});
