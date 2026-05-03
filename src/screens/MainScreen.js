import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import ScreenContainer from '../components/ScreenContainer';
import { FadeIn } from '../components/Animated';
import ShiftTable from '../components/ShiftTable';
import ShiftModal from '../components/ShiftModal';
import QuickShiftBar from '../components/QuickShiftBar';
import FilterBar from '../components/FilterBar';
import SummaryBar from '../components/SummaryBar';
import MileageSection from '../components/MileageSection';
import ExportMenu from '../components/ExportMenu';
import { computeShift } from '../utils/calculations';
import { uid, todayISO, formatDateLong, formatHM, formatMoney } from '../utils/helpers';
import { findJob, defaultJobId } from '../utils/jobs';

export default function MainScreen({
  shifts, setShifts,
  quickShifts,
  settings, setSettings,
  sortBy, setSortBy,
  onOpenSettings,
  onOpenQuickShifts,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [modal, setModal] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const openNew = useCallback(() => {
    const today = todayISO();
    const jobs = settings.jobs || [];
    const activeId = defaultJobId(jobs, settings.lastUsedJobId);
    const job = findJob(jobs, activeId);
    const rate = job ? job.hourlyRate : Number(settings.defaultHourlyRate) || 0;
    setModal({
      open: true, isEdit: false,
      shift: {
        id: uid(), date: today, start: '09:00', end: '17:00',
        hourlyRate: rate, jobId: activeId || null,
        breakMinutes: 30, breakPaid: false,
        overtimeMinutes: 0, mileageKm: 0, notes: '', tags: [],
      },
    });
  }, [settings]);

  const openEdit = useCallback((shift) => {
    setModal({ open: true, isEdit: true, shift: { ...shift } });
  }, []);

  const saveShift = (sh) => {
    setShifts((prev) => {
      const exists = prev.find((x) => x.id === sh.id);
      return exists ? prev.map((x) => (x.id === sh.id ? sh : x)) : [sh, ...prev];
    });
    // Track last-used job so the Quick Shift bar pre-selects it next time.
    if (sh.jobId && sh.jobId !== settings.lastUsedJobId) {
      setSettings((prev) => ({ ...prev, lastUsedJobId: sh.jobId }));
    }
    setModal(null);
  };

  const deleteShift = (id) => {
    setShifts((prev) => prev.filter((x) => x.id !== id));
    setModal(null);
  };

  const deleteShifts = (ids) => {
    const idSet = new Set(ids);
    setShifts((prev) => prev.filter((x) => !idSet.has(x.id)));
  };

  const bulkEdit = (ids, patch) => {
    const idSet = new Set(ids);
    setShifts((prev) =>
      prev.map((sh) => {
        if (!idSet.has(sh.id)) return sh;
        const next = { ...sh };
        if (patch.notes) {
          if (patch.notesMode === 'append') {
            next.notes = sh.notes ? `${sh.notes}\n${patch.notes}` : patch.notes;
          } else {
            next.notes = patch.notes;
          }
        }
        if (patch.hourlyRate !== undefined) next.hourlyRate = patch.hourlyRate;
        if (patch.tags !== undefined) next.tags = patch.tags;
        if (patch.jobId !== undefined) next.jobId = patch.jobId;
        return next;
      })
    );
  };

  const addQuickShift = (q) => {
    const date = q.date || todayISO();
    const shift = {
      id: uid(),
      date,
      start: q.start, end: q.end,
      hourlyRate: Number(q.hourlyRate) || 0,
      jobId: q.jobId || null,
      breakMinutes: q.breakMinutes, breakPaid: q.breakPaid,
      overtimeMinutes: q.overtimeMinutes,
      mileageKm: Number(q.mileageKm) || 0,
      notes: q.notes || '',
      tags: q.tags || [],
    };
    setShifts((prev) => [shift, ...prev]);
    if (q.jobId && q.jobId !== settings.lastUsedJobId) {
      setSettings((prev) => ({ ...prev, lastUsedJobId: q.jobId }));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = shifts.filter((sh) => {
      if (q) {
        const hay = `${sh.notes || ''} ${(sh.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom && sh.date < dateFrom) return false;
      if (dateTo && sh.date > dateTo) return false;
      return true;
    });

    const cmp = {
      'date-desc': (a, b) => (b.date + b.start).localeCompare(a.date + a.start),
      'date-asc': (a, b) => (a.date + a.start).localeCompare(b.date + b.start),
      'hours-desc': (a, b) => computeShift(b, settings).paidMinutes - computeShift(a, settings).paidMinutes,
      'pay-desc': (a, b) => computeShift(b, settings).pay - computeShift(a, settings).pay,
    }[sortBy] || (() => 0);

    return [...list].sort(cmp);
  }, [shifts, search, dateFrom, dateTo, sortBy, settings]);

  const summaryText = useMemo(() => {
    let mins = 0, pay = 0, km = 0;
    for (const sh of filtered) {
      const c = computeShift(sh, settings);
      mins += c.paidMinutes; pay += c.pay; km += Number(sh.mileageKm) || 0;
    }
    const parts = [`${filtered.length} shifts`, formatHM(mins)];
    if (settings.showWage) parts.push(formatMoney(pay));
    if (settings.trackMileage && km > 0) parts.push(`${km.toFixed(1)} km`);
    return parts.join(' · ');
  }, [filtered, settings]);

  const dateRangeText = useMemo(() => {
    if (filtered.length === 0) return '';
    const dates = filtered.map((sh) => sh.date).sort();
    return `${formatDateLong(dates[0])} — ${formatDateLong(dates[dates.length - 1])}`;
  }, [filtered]);

  return (
    <ScreenContainer>
      <View style={s.header}>
        <View style={s.headerTitle}>
          <Text style={s.appName}>ShiftyLog</Text>
          <View style={s.badge}><Text style={s.badgeText}>v1</Text></View>
        </View>
        <View style={s.headerActions}>
          <Pressable
            onPress={() => setExportOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Export shifts"
            style={({ pressed }) => [s.headerPill, pressed && s.headerPillPressed]}
          >
            <Ionicons name="download-outline" size={16} color={C.textSubtle} />
            <Text style={s.headerPillText}>Export</Text>
          </Pressable>
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [s.headerBtn, pressed && s.headerBtnPressed]}
          >
            <Ionicons name="settings-outline" size={22} color={C.textSubtle} />
          </Pressable>
        </View>
      </View>

      <View style={s.topSection}>
        <FadeIn delay={0}>
          <QuickShiftBar
            quickShifts={quickShifts}
            settings={settings}
            onAdd={addQuickShift}
            onManage={onOpenQuickShifts}
          />
        </FadeIn>
        <FadeIn delay={60}>
          <FilterBar
            search={search} setSearch={setSearch}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            sortBy={sortBy} setSortBy={setSortBy}
            onClear={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
          />
        </FadeIn>
        <FadeIn delay={120}>
          <SummaryBar shifts={filtered} settings={settings} />
        </FadeIn>
        <FadeIn delay={180}>
          <MileageSection shifts={filtered} settings={settings} setSettings={setSettings} />
        </FadeIn>

        <FadeIn delay={220}>
          <Pressable
            onPress={openNew}
            accessibilityRole="button"
            accessibilityLabel="Create a new shift"
            style={({ pressed }) => [
              s.createBtn,
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Ionicons name="add-circle" size={20} color={C.accentInk} />
            <Text style={s.createText}>Create shift</Text>
          </Pressable>
        </FadeIn>
      </View>

      <View style={s.tableWrap}>
        {shifts.length === 0 ? (
          <FadeIn delay={260} style={{ flex: 1 }}>
            <View style={s.emptyFull}>
              <Ionicons name="time-outline" size={38} color={C.textDim} />
              <Text style={s.emptyTitle}>No shifts yet</Text>
              <Text style={s.emptyHint}>Tap “Create shift” to add one, or use Quick Shifts above.</Text>
            </View>
          </FadeIn>
        ) : (
          <FadeIn delay={260} style={{ flex: 1 }}>
            <ShiftTable
              shifts={filtered}
              settings={settings}
              onEdit={openEdit}
              onDeleteShifts={deleteShifts}
              onBulkEdit={bulkEdit}
            />
          </FadeIn>
        )}
      </View>

      {modal && (
        <ShiftModal
          open={modal.open}
          initial={modal.shift}
          isEdit={modal.isEdit}
          settings={settings}
          onSave={saveShift}
          onDelete={deleteShift}
          onClose={() => setModal(null)}
        />
      )}

      <ExportMenu
        open={exportOpen}
        shifts={filtered}
        settings={settings}
        summaryText={summaryText}
        dateRangeText={dateRangeText}
        onClose={() => setExportOpen(false)}
      />
    </ScreenContainer>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.borderFaint,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  badge: {
    backgroundColor: C.accentBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.accentBright, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  headerPillPressed: { backgroundColor: C.surfaceHov, opacity: 0.85 },
  headerPillText: { fontSize: 13, fontWeight: '600', color: C.textSubtle },
  headerBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  headerBtnPressed: { backgroundColor: C.surfaceHov, opacity: 0.85 },

  topSection: { gap: 10, padding: 12 },

  tableWrap: { flex: 1, overflow: 'hidden' },

  emptyFull: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted, marginTop: 8 },
  emptyHint: { fontSize: 13, color: C.textFaint, textAlign: 'center' },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    height: 50,
    borderRadius: 14,
    shadowColor: C.accentDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  createText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.accentInk,
    letterSpacing: 0.3,
  },
});
