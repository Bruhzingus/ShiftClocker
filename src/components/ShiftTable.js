import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, FlatList, StyleSheet,
  Modal, Animated, Easing, Platform, useWindowDimensions,
  LayoutAnimation, UIManager,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Btn, ConfirmDialog } from './common';
import { computeShift } from '../utils/calculations';
import { formatDateMed, formatHM, formatMoney } from '../utils/helpers';
import { findJob } from '../utils/jobs';
import BulkEditModal from './BulkEditModal';

// LayoutAnimation needs an explicit opt-in on Android (old architecture). Safe
// no-op on the new architecture / iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Column widths ────────────────────────────────────────────────────────────

const W = {
  check: 36,
  date:  118,
  hours:  58,
  break:  46,
  ot:     46,
  pay:    56,
  tips:   52,
  job:    80,
  km:     44,
  notes: 190,
};

function tableWidth(settings, selectionMode, hasJobs, hasTipsJobs) {
  let w = W.date + W.hours + W.notes;
  if (selectionMode)                    w += W.check;
  if (settings.trackBreaks)            w += W.break;
  if (settings.trackOvertime)          w += W.ot;
  if (settings.showWage)               w += W.pay;
  if (settings.showWage && hasTipsJobs) w += W.tips;
  if (hasJobs)                         w += W.job;
  if (settings.trackMileage)           w += W.km;
  return w;
}

// ─── Sort config ──────────────────────────────────────────────────────────────

// First direction when clicking a fresh column
const FIRST_DIR = {
  date: 'asc', hours: 'desc', break: 'desc', ot: 'desc',
  pay: 'desc', km: 'desc', job: 'asc', notes: 'desc',
};
// Columns that only toggle on/off (no reverse direction)
const TWO_STATE = new Set(['job', 'notes']);

// ─── Note popup ───────────────────────────────────────────────────────────────

function NotePopup({ shift, settings, onEdit, onClose }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const scale   = useRef(new Animated.Value(0.93)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, friction: 7, tension: 140 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(scale,   { toValue: 0.95, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 120, useNativeDriver: true }),
    ]).start(onClose);
  };

  const c   = computeShift(shift, settings);
  const job = shift.jobId ? findJob(settings.jobs, shift.jobId) : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[s.noteOverlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <Animated.View style={[s.noteCard, { transform: [{ scale }] }]}>
          {/* Header */}
          <View style={s.noteHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.noteDate}>{formatDateMed(shift.date)}</Text>
              <Text style={s.noteTime}>
                {shift.start}–{shift.end}{'  ·  '}{formatHM(c.paidMinutes)}
                {settings.showWage && c.pay > 0 ? `  ·  ${formatMoney(c.pay)}` : ''}
              </Text>
            </View>
            <Pressable onPress={close} hitSlop={12} style={s.noteCloseBtn}>
              <Ionicons name="close" size={22} color={C.textSubtle} />
            </Pressable>
          </View>

          {job && (
            <View style={s.noteJobRow}>
              <View style={[s.noteJobDot, { backgroundColor: job.color || C.accent }]} />
              <Text style={s.noteJobName}>{job.name}</Text>
            </View>
          )}

          <ScrollView style={s.noteBody} keyboardShouldPersistTaps="handled">
            <Text selectable style={s.noteText}>
              {shift.notes || 'No notes for this shift.'}
            </Text>
            {settings.trackTags && shift.tags?.length > 0 && (
              <View style={s.tagsRow}>
                {shift.tags.map((t) => <Text key={t} style={s.tag}>#{t}</Text>)}
              </View>
            )}
            {settings.trackMileage && (shift.mileageKm || 0) > 0 && (
              <Text style={s.noteKm}>
                <Ionicons name="car-outline" size={13} color={C.textFaint} /> {shift.mileageKm} km
              </Text>
            )}
            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={s.noteFooter}>
            <Btn variant="primary" onPress={() => { close(); setTimeout(() => onEdit(shift), 150); }}>
              <Ionicons name="pencil-outline" size={16} color={C.accentInk} />
              <Text style={s.noteEditText}>Edit shift</Text>
            </Btn>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Header cell (pressable + sort indicator) ─────────────────────────────────

function HeaderCell({ label, col, sortCol, sortDir, onPress, width, flex }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const active = sortCol === col;
  const style  = width ? { width } : { flex: flex || 1 };
  return (
    <Pressable
      style={[s.headerCellWrap, style, active && s.headerCellActive]}
      onPress={() => onPress(col)}
      accessibilityRole="button"
    >
      <Text style={[s.headerCell, active && s.headerCellOn]}>{label}</Text>
      {active && (
        <Ionicons
          name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
          size={9} color={C.accent}
          style={{ marginLeft: 2 }}
        />
      )}
    </Pressable>
  );
}

function TableHeader({ settings, selectionMode, allSelected, onSelectAll, hasJobs, hasTipsJobs, sortCol, sortDir, onHeaderPress }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const H = (label, col, width) => (
    <HeaderCell key={col} label={label} col={col} sortCol={sortCol} sortDir={sortDir} onPress={onHeaderPress} width={width} />
  );
  return (
    <View style={s.headerRow}>
      {selectionMode && (
        <Pressable style={[s.cell, { width: W.check }]} onPress={onSelectAll}>
          <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={18} color={allSelected ? C.accent : C.textFaint} />
        </Pressable>
      )}
      {H('DATE / TIME', 'date', W.date)}
      {H('HRS',  'hours', W.hours)}
      {settings.trackBreaks   && H('BRK', 'break', W.break)}
      {settings.trackOvertime && H('OT',  'ot',    W.ot)}
      {settings.showWage      && H('PAY', 'pay',   W.pay)}
      {settings.showWage && hasTipsJobs && H('TIPS', 'tips', W.tips)}
      {hasJobs                && H('JOB', 'job',   W.job)}
      {settings.trackMileage  && H('KM',  'km',    W.km)}
      <HeaderCell label="NOTES" col="notes" sortCol={sortCol} sortDir={sortDir} onPress={onHeaderPress} flex={1} />
    </View>
  );
}

// ─── Shift row ────────────────────────────────────────────────────────────────

function ShiftRow({ shift, settings, selectionMode, selected, onSelectToggle, onLongPress, onNoteOpen, index, hasJobs, hasTipsJobs }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const c         = computeShift(shift, settings);
  const breakText = (shift.breakMinutes || 0) > 0 ? `${shift.breakMinutes}m${shift.breakPaid ? '✓' : ''}` : '—';
  const otText    = (shift.overtimeMinutes || 0) > 0 ? formatHM(Number(shift.overtimeMinutes)) : '—';
  const isAlt     = index % 2 === 1;
  const job       = hasJobs ? findJob(settings.jobs, shift.jobId) : null;

  return (
    <Pressable
      onPress={() => { if (selectionMode) onSelectToggle(); else onNoteOpen(); }}
      onLongPress={onLongPress}
      style={({ pressed }) => [s.row, isAlt && s.rowAlt, selected && s.rowSelected, pressed && s.rowPressed]}
    >
      <View style={s.rowCells}>
        {selectionMode && (
          <View style={[s.cell, { width: W.check }]}>
            <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? C.accent : C.textFaint} />
          </View>
        )}

        <View style={[s.cell, { width: W.date }]}>
          <Text style={s.cellDate} numberOfLines={1}>{formatDateMed(shift.date)}</Text>
          <Text style={s.cellTime} numberOfLines={1}>{shift.start}–{shift.end}</Text>
        </View>

        <View style={[s.cell, { width: W.hours }]}>
          <Text style={s.cellNum} numberOfLines={1}>{formatHM(c.paidMinutes)}</Text>
        </View>

        {settings.trackBreaks && (
          <View style={[s.cell, { width: W.break }]}>
            <Text style={s.cellSub}>{breakText}</Text>
          </View>
        )}

        {settings.trackOvertime && (
          <View style={[s.cell, { width: W.ot }]}>
            <Text style={[s.cellSub, (shift.overtimeMinutes || 0) > 0 && s.cellAccent]}>{otText}</Text>
          </View>
        )}

        {settings.showWage && (
          <View style={[s.cell, { width: W.pay }]}>
            <Text style={s.cellPay}>{formatMoney(c.pay)}</Text>
          </View>
        )}

        {settings.showWage && hasTipsJobs && (
          <View style={[s.cell, { width: W.tips }]}>
            <Text style={[s.cellSub, (Number(shift.tips) || 0) > 0 && s.cellAccent]}>
              {(Number(shift.tips) || 0) > 0 ? formatMoney(Number(shift.tips)) : '—'}
            </Text>
          </View>
        )}

        {hasJobs && (
          <View style={[s.cell, { width: W.job }]}>
            {job ? (
              <View style={s.jobChip}>
                <View style={[s.jobDot, { backgroundColor: job.color || C.accent }]} />
                <Text style={s.jobChipText} numberOfLines={1}>{job.name}</Text>
              </View>
            ) : <Text style={s.cellSub}>—</Text>}
          </View>
        )}

        {settings.trackMileage && (
          <View style={[s.cell, { width: W.km }]}>
            <Text style={[s.cellSub, (shift.mileageKm || 0) > 0 && s.cellKm]}>
              {(shift.mileageKm || 0) > 0 ? String(shift.mileageKm) : '—'}
            </Text>
          </View>
        )}

        <View style={[s.cell, s.notesCell]}>
          <Text style={s.notesText} numberOfLines={1}>{shift.notes || '—'}</Text>
          {settings.trackTags && shift.tags?.length > 0 && (
            <View style={s.tagsRow}>
              {shift.tags.map((t) => <Text key={t} style={s.tag}>#{t}</Text>)}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Selection toolbar ────────────────────────────────────────────────────────

function SelectionToolbar({ count, onDelete, onEdit, onCancel }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <View style={s.toolbar}>
      <Pressable onPress={onCancel} style={s.toolbarCancel}>
        <Ionicons name="close" size={20} color={C.textSubtle} />
      </Pressable>
      <Text style={s.toolbarCount}>{count} selected</Text>
      <View style={s.toolbarActions}>
        {count > 0 && (
          <>
            <Btn variant="ghost" onPress={onEdit} small>
              <Ionicons name="pencil-outline" size={15} color={C.textSubtle} />
              <Text style={s.toolbarBtnText}>Edit</Text>
            </Btn>
            <Btn variant="danger" onPress={onDelete} small>
              <Ionicons name="trash-outline" size={15} color={C.danger} />
              <Text style={[s.toolbarBtnText, { color: C.danger }]}>Delete</Text>
            </Btn>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Period nav bar ───────────────────────────────────────────────────────────
// Each instance owns its gesture via react-native-gesture-handler so Android
// properly handles the swipe without fighting the ScrollView responder system.

function PeriodNavBar({ period, periodRange, canGoFwd, onPrev, onNext }) {
  const C = useTheme();
  const s = useStyles(makeStyles);

  const isAll = period === 'all';

  // Keep latest values in refs so the gesture (created once) always sees them.
  const prevRef   = useRef(onPrev);
  const nextRef   = useRef(onNext);
  const isAllRef  = useRef(isAll);
  useEffect(() => { prevRef.current = onPrev; nextRef.current = onNext; isAllRef.current = isAll; }, [onPrev, onNext, isAll]);

  const pan = useRef(
    Gesture.Pan()
      .runOnJS(true)
      .onEnd((e) => {
        if (isAllRef.current) return;
        const isHorizontal = Math.abs(e.translationX) > 30 && Math.abs(e.translationX) > Math.abs(e.translationY);
        if (!isHorizontal) return;
        if (e.translationX < 0) nextRef.current?.();  // swipe left → next period
        else                    prevRef.current?.();  // swipe right → prev period
      }),
  ).current;

  const label = isAll ? 'All time' : (periodRange?.label ?? '—');

  return (
    <View style={s.periodNav}>
      {/* Fixed-width left side — hidden on All tab */}
      <Pressable
        onPress={isAll ? undefined : onPrev}
        hitSlop={14}
        style={[s.periodNavSide, isAll && { opacity: 0 }]}
        disabled={isAll}
      >
        <Ionicons name="chevron-back" size={26} color={C.accent} />
      </Pressable>

      {/* Center: swipeable via gesture handler — no Pressable children */}
      <GestureDetector gesture={pan}>
        <View style={s.periodNavCenter}>
          <Text style={s.periodNavLabel} numberOfLines={1}>{label}</Text>
          {!isAll && <Text style={s.periodNavHint}>← swipe →</Text>}
        </View>
      </GestureDetector>

      {/* Fixed-width right side — hidden on All tab */}
      <Pressable
        onPress={() => !isAll && canGoFwd && onNext?.()}
        hitSlop={14}
        style={[s.periodNavSide, (isAll || !canGoFwd) && { opacity: isAll ? 0 : 0.35 }]}
        disabled={isAll}
      >
        <Ionicons name="chevron-forward" size={26} color={(!isAll && canGoFwd) ? C.accent : C.textDim} />
      </Pressable>
    </View>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function ShiftTable({
  shifts, settings, onEdit, onDeleteShifts, onBulkEdit,
  period, periodOffset, periodRange, onPeriodPrev, onPeriodNext,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [bulkEditOpen,  setBulkEditOpen]  = useState(false);

  // Note popup
  const [openNote, setOpenNote] = useState(null);

  // Column sort — single-column, cycles through states.
  // Default to date ASC so the table is always chronological even when shifts
  // were entered/imported out of order.
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  const cycleSort = useCallback((col) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir(FIRST_DIR[col] || 'asc');
    } else {
      const first  = FIRST_DIR[col] || 'asc';
      const second = first === 'asc' ? 'desc' : 'asc';
      if (TWO_STATE.has(col)) {
        // Only 2 states: on → off
        setSortCol(null); setSortDir('asc');
      } else if (sortDir === first) {
        setSortDir(second);
      } else {
        // Was on second direction → clear
        setSortCol(null); setSortDir('asc');
      }
    }
  }, [sortCol, sortDir]);

  // Apply sort after filtering. When sortCol is cleared (cycled to null),
  // fall back to date ASC so we never display in raw insertion order.
  const sortedShifts = useMemo(() => {
    const effCol = sortCol || 'date';
    const effDir = sortCol ? sortDir : 'asc';
    const pre = shifts.map((sh) => ({ sh, c: computeShift(sh, settings) }));
    pre.sort(({ sh: a, c: ca }, { sh: b, c: cb }) => {
      let cmp = 0;
      switch (effCol) {
        case 'date':  cmp = (a.date + a.start).localeCompare(b.date + b.start); break;
        case 'hours': cmp = ca.paidMinutes - cb.paidMinutes; break;
        case 'break': cmp = (a.breakMinutes || 0) - (b.breakMinutes || 0); break;
        case 'ot':    cmp = (a.overtimeMinutes || 0) - (b.overtimeMinutes || 0); break;
        case 'pay':   cmp = ca.pay - cb.pay; break;
        case 'km':    cmp = (a.mileageKm || 0) - (b.mileageKm || 0); break;
        case 'job': {
          const ja = findJob(settings.jobs, a.jobId)?.name || '';
          const jb = findJob(settings.jobs, b.jobId)?.name || '';
          cmp = ja.localeCompare(jb); break;
        }
        case 'notes': cmp = (a.notes?.length || 0) - (b.notes?.length || 0); break;
      }
      return effDir === 'asc' ? cmp : -cmp;
    });
    return pre.map(({ sh }) => sh);
  }, [shifts, sortCol, sortDir, settings]);

  // Smoothly animate height when rows are added/removed (add shift, delete, filter).
  const prevCountRef = useRef(sortedShifts.length);
  useEffect(() => {
    if (prevCountRef.current !== sortedShifts.length) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
      prevCountRef.current = sortedShifts.length;
    }
  }, [sortedShifts.length]);

  // ── Slide-in animation when the period changes ────────────────────────────
  const { width: screenWidth } = useWindowDimensions();
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const prevOffsetRef  = useRef(periodOffset);
  const prevPeriodRef  = useRef(period);
  const isFirstSlide   = useRef(true);

  useEffect(() => {
    if (isFirstSlide.current) { isFirstSlide.current = false; return; }

    const prevOffset = prevOffsetRef.current;
    const prevPeriod = prevPeriodRef.current;
    prevOffsetRef.current = periodOffset;
    prevPeriodRef.current = period;

    // Only animate directionally when navigating within the same non-All period type
    if (period !== prevPeriod || period === 'all' || periodOffset === prevOffset) {
      slideAnim.setValue(0);
      return;
    }

    // Earlier period → new content enters from the left; later → from the right.
    // Use 30% of screen width so the travel distance is short and the animation
    // completes quickly even when gestures come in rapid succession.
    const dir = periodOffset < prevOffset ? -1 : 1;
    slideAnim.stopAnimation();
    slideAnim.setValue(dir * screenWidth * 0.3);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [period, periodOffset]);

  // Selection handlers
  const enterSelection = useCallback((id) => { setSelectionMode(true); setSelectedIds(new Set([id])); }, []);
  const exitSelection  = useCallback(() => { setSelectionMode(false); setSelectedIds(new Set()); }, []);
  const toggleSelect   = useCallback((id) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const allSelected     = shifts.length > 0 && selectedIds.size === shifts.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(shifts.map((sh) => sh.id)));
  };

  const handleDelete    = () => { onDeleteShifts([...selectedIds]); exitSelection(); setDeleteConfirm(false); };
  const handleBulkEdit  = (patch) => { onBulkEdit([...selectedIds], patch); exitSelection(); setBulkEditOpen(false); };

  // Compute table width before the gesture so .enabled() can use it.
  const hasJobs     = Array.isArray(settings.jobs) && settings.jobs.length > 0;
  const hasTipsJobs = Array.isArray(settings.jobs) && settings.jobs.some((j) => j.hasTips);
  const tWidth      = tableWidth(settings, selectionMode, hasJobs, hasTipsJobs);
  const canGoFwd    = periodOffset < 0;

  // ── Table body swipe ────────────────────────────────────────────────────────
  // Refs keep the gesture closure pointing at the latest callbacks without
  // capturing stale values each time the gesture is recreated.
  const prevGRef   = useRef(onPeriodPrev);
  const nextGRef   = useRef(onPeriodNext);
  const lastNavRef = useRef(0);
  useEffect(() => {
    prevGRef.current = onPeriodPrev;
    nextGRef.current = onPeriodNext;
  }, [onPeriodPrev, onPeriodNext]);

  // Recreated only when period type or table-fit status changes (not on every
  // offset step).  .enabled(false) on All tab / wide-table means the gesture
  // never *activates* (never claims the touch), so the horizontal ScrollView
  // retains full control when it actually has content to scroll.
  const tableSwipe = useMemo(() =>
    Gesture.Pan()
      .runOnJS(true)
      .enabled(period !== 'all' && tWidth <= screenWidth)
      .activeOffsetX([-38, 38])
      .failOffsetY([-15, 15])
      .onEnd((e) => {
        const isSwipe = Math.abs(e.translationX) >= 38 || Math.abs(e.velocityX) >= 600;
        if (!isSwipe) return;
        // 400 ms cooldown suppresses jittery back-and-forth false triggers
        const now = Date.now();
        if (now - lastNavRef.current < 400) return;
        lastNavRef.current = now;
        const dx = Math.abs(e.translationX) >= 10 ? e.translationX : e.velocityX;
        if (dx < 0) nextGRef.current?.();
        else        prevGRef.current?.();
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [period, tWidth, screenWidth]);

  // ── Edge-scroll: period nav when the table IS wider than the screen ─────────
  // (tableSwipe is disabled in that case, so this is the wide-table fallback.)
  const dragStartX = useRef(0);

  const onScrollBeginDrag = useCallback((e) => {
    dragStartX.current = e.nativeEvent.contentOffset.x;
  }, []);

  const onScrollEndDrag = useCallback((e) => {
    if (period === 'all') return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const x    = contentOffset.x;
    const maxX = Math.max(0, contentSize.width - layoutMeasurement.width);
    if (maxX < 4) return;
    const vel     = e.nativeEvent.velocity?.x ?? 0;
    const atLeft  = x <= 4;
    const atRight = x >= maxX - 4;
    if (atLeft  && (vel < -0.2 || (dragStartX.current <= 4       && vel <= 0))) onPeriodPrev?.();
    else if (atRight && (vel > 0.2  || (dragStartX.current >= maxX - 4 && vel >= 0))) onPeriodNext?.();
  }, [period, onPeriodPrev, onPeriodNext]);

  if (shifts.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <GestureDetector gesture={tableSwipe}>
          <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
            <View style={s.empty}><Text style={s.emptyText}>No shifts match your filters.</Text></View>
          </Animated.View>
        </GestureDetector>
        <PeriodNavBar
          period={period} periodRange={periodRange} canGoFwd={canGoFwd}
          onPrev={onPeriodPrev} onNext={onPeriodNext}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {selectionMode && <SelectionToolbar count={selectedIds.size} onCancel={exitSelection} onDelete={() => setDeleteConfirm(true)} onEdit={() => setBulkEditOpen(true)} />}

      {/* ── Table content — GestureDetector only here, not over the nav bar ── */}
      <GestureDetector gesture={tableSwipe}>
      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView
          horizontal
          style={{ flex: 1 }}
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          contentContainerStyle={{ flexGrow: 1 }}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          scrollEventThrottle={32}
        >
          <View style={{ width: Math.max(tWidth, 320), flex: 1 }}>
            <TableHeader
              settings={settings}
              selectionMode={selectionMode}
              allSelected={allSelected}
              onSelectAll={toggleSelectAll}
              hasJobs={hasJobs}
              hasTipsJobs={hasTipsJobs}
              sortCol={sortCol}
              sortDir={sortDir}
              onHeaderPress={cycleSort}
            />
            <FlatList
              data={sortedShifts}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews
              initialNumToRender={20}
              windowSize={11}
              maxToRenderPerBatch={20}
              ListFooterComponent={<View style={{ height: 8 }} />}
              renderItem={({ item, index }) => (
                <ShiftRow
                  shift={item}
                  settings={settings}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(item.id)}
                  index={index}
                  onSelectToggle={() => toggleSelect(item.id)}
                  onLongPress={() => { if (!selectionMode) enterSelection(item.id); }}
                  onNoteOpen={() => setOpenNote(item)}
                  hasJobs={hasJobs}
                  hasTipsJobs={hasTipsJobs}
                />
              )}
            />
          </View>
        </ScrollView>
      </Animated.View>
      </GestureDetector>

      {/* ── Period nav — outside GestureDetector; has its own centerPan gesture ── */}
      <PeriodNavBar
        period={period} periodRange={periodRange} canGoFwd={canGoFwd}
        onPrev={onPeriodPrev} onNext={onPeriodNext}
      />

      {/* Note popup */}
      {openNote && (
        <NotePopup
          shift={openNote}
          settings={settings}
          onEdit={(sh) => { setOpenNote(null); onEdit(sh); }}
          onClose={() => setOpenNote(null)}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm}
        title={`Delete ${selectedIds.size} shift${selectedIds.size !== 1 ? 's' : ''}?`}
        message="This cannot be undone." confirmLabel="Delete" danger
        onConfirm={handleDelete} onCancel={() => setDeleteConfirm(false)}
      />
      <BulkEditModal
        open={bulkEditOpen} count={selectedIds.size} settings={settings}
        onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (C) => StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingVertical: 7, paddingHorizontal: 10,
  },
  headerCellWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 4,
  },
  headerCellActive: { backgroundColor: C.accentBg, borderRadius: 4 },
  headerCell:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: C.textFaint },
  headerCellOn: { color: C.accent },

  // Rows
  row: {
    flexDirection: 'column', borderBottomWidth: 1,
    borderBottomColor: C.borderFaint, paddingHorizontal: 10, backgroundColor: C.bg,
  },
  rowCells:    { flexDirection: 'row' },
  rowAlt:      { backgroundColor: C.surfaceAlt },
  rowSelected: { backgroundColor: C.accentBg },
  rowPressed:  { opacity: 0.8 },
  cell: { paddingHorizontal: 3, paddingVertical: 6, justifyContent: 'flex-start' },
  notesCell: { flex: 1 },

  // Cell text
  cellDate:   { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  cellTime:   { fontSize: 11, color: C.textSubtle, marginTop: 2, fontVariant: ['tabular-nums'] },
  cellNum:    { fontSize: 12, color: C.text, fontWeight: '500', fontVariant: ['tabular-nums'] },
  cellSub:    { fontSize: 11, color: C.textFaint, fontVariant: ['tabular-nums'] },
  cellAccent: { color: C.accentBright },
  cellKm:     { color: C.textSubtle },
  cellPay:    { fontSize: 12, color: C.accentBright, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Job chip
  jobChip:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jobDot:      { width: 7, height: 7, borderRadius: 3.5 },
  jobChipText: { fontSize: 11, color: C.textMuted, fontWeight: '500', flexShrink: 1 },

  // Notes
  notesText:  { fontSize: 12, color: C.textSubtle, lineHeight: 16 },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 },
  tag:        { fontSize: 10, color: C.textFaint, backgroundColor: C.surfaceHov, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },

  // Period nav bar
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 38 : 12,
  },
  // Fixed equal width on both sides keeps the label perfectly centred
  periodNavSide: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  periodNavCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  periodNavLabel: {
    fontSize: 14, fontWeight: '600', color: C.text,
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
  periodNavHint: { fontSize: 10, color: C.textDim, marginTop: 2 },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 10, paddingVertical: 7, gap: 8,
  },
  toolbarCancel:  { padding: 4 },
  toolbarCount:   { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  toolbarBtnText: { fontSize: 12, fontWeight: '500', color: C.textSubtle },

  // Empty
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: C.textFaint },

  // Note popup
  noteOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  noteCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 28, elevation: 20,
  },
  noteHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  noteDate:     { fontSize: 17, fontWeight: '700', color: C.text },
  noteTime:     { fontSize: 13, color: C.textFaint, marginTop: 3, fontVariant: ['tabular-nums'] },
  noteCloseBtn: { padding: 4 },
  noteJobRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  noteJobDot:   { width: 10, height: 10, borderRadius: 5 },
  noteJobName:  { fontSize: 13, color: C.textMuted, fontWeight: '600' },
  noteBody:     { paddingHorizontal: 20, paddingTop: 16, maxHeight: 360 },
  noteText:     { fontSize: 15, color: C.text, lineHeight: 23 },
  noteKm:       { fontSize: 12, color: C.textFaint, marginTop: 10 },
  noteFooter:   { padding: 16, borderTopWidth: 1, borderTopColor: C.borderFaint },
  noteEditText: { fontSize: 14, fontWeight: '700', color: C.accentInk },
});
