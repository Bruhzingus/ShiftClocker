import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import ScreenContainer from '../components/ScreenContainer';
import { FadeIn } from '../components/Animated';
import ShiftTable from '../components/ShiftTable';
import ShiftModal from '../components/ShiftModal';
import QuickShiftBar from '../components/QuickShiftBar';
import ClockBar from '../components/ClockBar';
import CalendarView from '../components/CalendarView';
import DaySheet from '../components/DaySheet';
import FilterBar from '../components/FilterBar';
import PeriodBar from '../components/PeriodBar';
import SummaryBar from '../components/SummaryBar';
import ExportMenu from '../components/ExportMenu';
import { computeShift } from '../utils/calculations';
import { uid, todayISO, formatDateLong, formatHM, formatMoney } from '../utils/helpers';
import { findJob, defaultJobId, getJobEffectiveRate } from '../utils/jobs';
import { computePeriodRange } from '../utils/periods';
import { tapLight, tapMedium } from '../utils/haptics';

export default function MainScreen({
  shifts, setShifts,
  quickShifts,
  settings, setSettings,
  activeClock, setActiveClock,
  onOpenSettings, onOpenStats,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [modal, setModal] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [daySheet, setDaySheet] = useState(null);    // ISO date or null
  const [search, setSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [period, setPeriod] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);

  const periodRange = useMemo(
    () => computePeriodRange(period, periodOffset, settings),
    [period, periodOffset, settings]
  );

  const dateFrom = period !== 'all' ? (periodRange?.dateFrom || '') : filterDateFrom;
  const dateTo   = period !== 'all' ? (periodRange?.dateTo   || '') : filterDateTo;

  const openNew = useCallback(() => {
    const jobs = settings.jobs || [];
    const activeId = defaultJobId(jobs, settings.lastUsedJobId);
    const job = findJob(jobs, activeId);
    const rate = job
      ? getJobEffectiveRate(job, todayISO(), settings)
      : Number(settings.defaultHourlyRate) || 0;
    setModal({
      open: true, isEdit: false,
      shift: {
        id: uid(), date: todayISO(), start: '08:00', end: '16:30',
        hourlyRate: rate, jobId: activeId || null,
        breakMinutes: 30, breakPaid: false,
        overtimeMinutes: 0, mileageKm: 0, tips: 0, notes: '', tags: [],
      },
    });
  }, [settings]);

  const openEdit = useCallback((shift) => {
    setModal({ open: true, isEdit: true, shift: { ...shift } });
  }, []);

  // New shift prefilled to a specific calendar day.
  const openNewForDay = useCallback((dateISO) => {
    const jobs = settings.jobs || [];
    const activeId = defaultJobId(jobs, settings.lastUsedJobId);
    const job = findJob(jobs, activeId);
    const rate = job
      ? getJobEffectiveRate(job, dateISO, settings)
      : Number(settings.defaultHourlyRate) || 0;
    setDaySheet(null);
    setModal({
      open: true, isEdit: false,
      shift: {
        id: uid(), date: dateISO, start: '08:00', end: '16:30',
        hourlyRate: rate, jobId: activeId || null,
        breakMinutes: 30, breakPaid: false,
        overtimeMinutes: 0, mileageKm: 0, tips: 0, notes: '', tags: [],
      },
    });
  }, [settings]);

  // Clock-out → open the New Shift modal prefilled from the live timer.
  const openClockOut = useCallback((prefill) => {
    const jobs = settings.jobs || [];
    const job = findJob(jobs, prefill.jobId);
    const rate = job
      ? getJobEffectiveRate(job, todayISO(), settings)
      : Number(settings.defaultHourlyRate) || 0;
    setModal({
      open: true, isEdit: false,
      shift: {
        id: uid(), date: todayISO(),
        start: prefill.start, end: prefill.end,
        hourlyRate: rate, jobId: prefill.jobId || null,
        breakMinutes: prefill.breakMinutes || 0, breakPaid: false,
        overtimeMinutes: 0, mileageKm: 0, tips: 0, notes: '', tags: [],
      },
    });
  }, [settings]);

  const saveShift = (sh) => {
    tapLight();
    setShifts((prev) => {
      const exists = prev.find((x) => x.id === sh.id);
      return exists ? prev.map((x) => (x.id === sh.id ? sh : x)) : [...prev, sh];
    });
    if (sh.jobId && sh.jobId !== settings.lastUsedJobId) {
      setSettings((prev) => ({ ...prev, lastUsedJobId: sh.jobId }));
    }
    setModal(null);
  };

  const deleteShift = (id) => {
    tapMedium();
    setShifts((prev) => prev.filter((x) => x.id !== id));
    setModal(null);
  };

  const deleteShifts = (ids) => {
    tapMedium();
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
          next.notes = patch.notesMode === 'append'
            ? (sh.notes ? `${sh.notes}\n${patch.notes}` : patch.notes)
            : patch.notes;
        }
        if (patch.hourlyRate !== undefined) next.hourlyRate = patch.hourlyRate;
        if (patch.tags !== undefined) next.tags = patch.tags;
        if (patch.jobId !== undefined) next.jobId = patch.jobId;
        return next;
      })
    );
  };

  const addQuickShift = (q) => {
    const shift = {
      id: uid(), date: q.date || todayISO(),
      start: q.start, end: q.end,
      hourlyRate: Number(q.hourlyRate) || 0,
      jobId: q.jobId || null,
      breakMinutes: q.breakMinutes, breakPaid: q.breakPaid,
      overtimeMinutes: q.overtimeMinutes,
      mileageKm: Number(q.mileageKm) || 0,
      tips: Number(q.tips) || 0,
      notes: q.notes || '', tags: q.tags || [],
    };
    tapLight();
    setShifts((prev) => [...prev, shift]);
    if (q.jobId && q.jobId !== settings.lastUsedJobId) {
      setSettings((prev) => ({ ...prev, lastUsedJobId: q.jobId }));
    }
  };

  // Period navigation passed to table.
  // Shared 250 ms cooldown prevents animation pile-up from rapid arrow taps.
  // (The table swipe gesture has its own stricter 400 ms cooldown on top of this.)
  const navCooldownRef = useRef(0);
  const onPeriodPrev = useCallback(() => {
    if (period === 'all') return;
    const now = Date.now();
    if (now - navCooldownRef.current < 250) return;
    navCooldownRef.current = now;
    setPeriodOffset((o) => o - 1);
  }, [period]);

  const onPeriodNext = useCallback(() => {
    if (period === 'all') return;
    const now = Date.now();
    if (now - navCooldownRef.current < 250) return;
    navCooldownRef.current = now;
    setPeriodOffset((o) => Math.min(0, o + 1));
  }, [period]);

  // Filter (no sort — column headers in ShiftTable handle it)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter((sh) => {
      if (q) {
        const hay = `${sh.notes || ''} ${(sh.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom && sh.date < dateFrom) return false;
      if (dateTo   && sh.date > dateTo)   return false;
      return true;
    });
  }, [shifts, search, dateFrom, dateTo]);

  const summaryText = useMemo(() => {
    let mins = 0, pay = 0, km = 0;
    for (const sh of filtered) {
      const c = computeShift(sh, settings);
      mins += c.paidMinutes; pay += c.pay; km += Number(sh.mileageKm) || 0;
    }
    const parts = [`${filtered.length} shift${filtered.length !== 1 ? 's' : ''}`, formatHM(mins)];
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
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTitle}>
          <Text style={s.appName}>ShiftClocker</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>v{Constants.expoConfig?.version || '2.0.0'}</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <Pressable
            onPress={onOpenStats}
            accessibilityRole="button"
            accessibilityLabel="Statistics"
            style={({ pressed }) => [s.headerBtn, pressed && s.headerBtnPressed]}
          >
            <Ionicons name="stats-chart-outline" size={20} color={C.textSubtle} />
          </Pressable>
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

      {/* Top section */}
      <View style={s.topSection}>
        <FadeIn delay={0}>
          <ClockBar
            activeClock={activeClock}
            setActiveClock={setActiveClock}
            settings={settings}
            onClockOut={openClockOut}
          />
        </FadeIn>
        <FadeIn delay={30}>
          <View style={s.toggleRow}>
            {['list', 'calendar'].map((m) => {
              const on = viewMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setViewMode(m)}
                  style={[s.toggleBtn, on && s.toggleBtnOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons
                    name={m === 'list' ? 'list-outline' : 'calendar-outline'}
                    size={15}
                    color={on ? C.accentBright : C.textFaint}
                  />
                  <Text style={[s.toggleText, on && s.toggleTextOn]}>
                    {m === 'list' ? 'List' : 'Calendar'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FadeIn>
        {viewMode === 'list' && (
          <>
            <FadeIn delay={40}>
              <QuickShiftBar
                quickShifts={quickShifts}
                settings={settings}
                onAdd={addQuickShift}
                onNewShift={openNew}
              />
            </FadeIn>
            <FadeIn delay={60}>
              <PeriodBar
                period={period}
                onPeriodChange={setPeriod}
                offset={periodOffset}
                onOffsetChange={setPeriodOffset}
                periodRange={periodRange}
              />
            </FadeIn>
            <FadeIn delay={80}>
              <FilterBar
                search={search} setSearch={setSearch}
                dateFrom={filterDateFrom} setDateFrom={setFilterDateFrom}
                dateTo={filterDateTo}   setDateTo={setFilterDateTo}
                onClear={() => { setSearch(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                periodActive={period !== 'all'}
              />
            </FadeIn>
            <FadeIn delay={110}>
              <SummaryBar shifts={filtered} settings={settings} />
            </FadeIn>
          </>
        )}
      </View>

      {/* Main area: calendar, empty state, or table */}
      <View style={s.tableWrap}>
        {viewMode === 'calendar' ? (
          <FadeIn delay={120} style={{ flex: 1 }}>
            <CalendarView shifts={shifts} settings={settings} onSelectDay={setDaySheet} />
          </FadeIn>
        ) : shifts.length === 0 ? (
          <FadeIn delay={160} style={{ flex: 1 }}>
            <View style={s.emptyFull}>
              <Ionicons name="time-outline" size={38} color={C.textDim} />
              <Text style={s.emptyTitle}>No shifts yet</Text>
              <Text style={s.emptyHint}>Clock in above, or tap "New" to add your first shift.</Text>
            </View>
          </FadeIn>
        ) : (
          <FadeIn delay={160} style={{ flex: 1 }}>
            <ShiftTable
              shifts={filtered}
              settings={settings}
              onEdit={openEdit}
              onDeleteShifts={deleteShifts}
              onBulkEdit={bulkEdit}
              period={period}
              periodOffset={periodOffset}
              periodRange={periodRange}
              onPeriodPrev={onPeriodPrev}
              onPeriodNext={onPeriodNext}
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
        viewShifts={filtered}
        allShifts={shifts}
        settings={settings}
        onClose={() => setExportOpen(false)}
      />

      {daySheet && (
        <DaySheet
          dateISO={daySheet}
          shifts={shifts}
          settings={settings}
          onEdit={(sh) => { setDaySheet(null); openEdit(sh); }}
          onAddForDay={openNewForDay}
          onClose={() => setDaySheet(null)}
        />
      )}
    </ScreenContainer>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  badge: {
    backgroundColor: C.accentBg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: C.accentBorder,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.accentBright, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 36, paddingHorizontal: 11, borderRadius: 9,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  headerPillPressed: { backgroundColor: C.surfaceHov, opacity: 0.85 },
  headerPillText: { fontSize: 13, fontWeight: '600', color: C.textSubtle },
  headerBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  headerBtnPressed: { backgroundColor: C.surfaceHov, opacity: 0.85 },
  topSection: { gap: 8, padding: 12 },
  toggleRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.borderFaint,
    padding: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: 'transparent',
  },
  toggleBtnOn: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
  toggleTextOn: { color: C.accentBright },
  tableWrap: { flex: 1, overflow: 'hidden' },
  emptyFull: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textMuted, marginTop: 8 },
  emptyHint: { fontSize: 13, color: C.textFaint, textAlign: 'center' },
});
