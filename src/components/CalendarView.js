import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { computeShift } from '../utils/calculations';
import { pad2, formatHM, formatMoney } from '../utils/helpers';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarView({ shifts, settings, onSelectDay }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [offset, setOffset] = useState(0); // months from current

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();

  const weekStart = Number(settings.payPeriod?.weekStartDay ?? 1); // 0=Sun, 1=Mon
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStart + i) % 7]),
    [weekStart]
  );

  // Aggregate shift totals by ISO date.
  const byDate = useMemo(() => {
    const map = {};
    for (const sh of shifts) {
      const c = computeShift(sh, settings);
      const e = map[sh.date] || { count: 0, mins: 0, pay: 0 };
      e.count += 1; e.mins += c.paidMinutes; e.pay += c.pay;
      map[sh.date] = e;
    }
    return map;
  }, [shifts, settings]);

  // Build the grid cells (leading blanks + day numbers, padded to full weeks).
  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const leading = (firstDow - weekStart + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < leading; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month, weekStart]);

  // Month totals for the header.
  const monthTotals = useMemo(() => {
    let mins = 0, pay = 0, count = 0;
    const prefix = `${year}-${pad2(month + 1)}-`;
    for (const [date, e] of Object.entries(byDate)) {
      if (date.startsWith(prefix)) { mins += e.mins; pay += e.pay; count += e.count; }
    }
    return { mins, pay, count };
  }, [byDate, year, month]);

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={12} style={s.navBtn}
          accessibilityRole="button" accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={C.accent} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <Text style={s.monthTotals}>
            {monthTotals.count} shift{monthTotals.count !== 1 ? 's' : ''} · {formatHM(monthTotals.mins)}
            {settings.showWage ? ` · ${formatMoney(monthTotals.pay)}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setOffset((o) => Math.min(0, o + 1))} hitSlop={12}
          style={[s.navBtn, offset >= 0 && { opacity: 0.3 }]} disabled={offset >= 0}
          accessibilityRole="button" accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={C.accent} />
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View style={s.weekRow}>
        {weekdayLabels.map((w, i) => (
          <View key={i} style={s.weekday}><Text style={s.weekdayText}>{w}</Text></View>
        ))}
      </View>

      {/* Grid */}
      <View style={s.grid}>
        {cells.map((day, i) => {
          if (day == null) return <View key={`b${i}`} style={s.cell} />;
          const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const e = byDate[iso];
          const isToday = iso === todayISO;
          return (
            <Pressable
              key={iso}
              onPress={() => onSelectDay(iso)}
              style={({ pressed }) => [s.cell, s.dayCell, e && s.dayCellActive, isToday && s.dayCellToday, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel={`${MONTHS[month]} ${day}${e ? `, ${e.count} shift${e.count !== 1 ? 's' : ''}` : ''}`}
            >
              <Text style={[s.dayNum, isToday && s.dayNumToday]}>{day}</Text>
              {e ? (
                <Text style={s.dayHours} numberOfLines={1}>
                  {settings.showWage ? formatMoney(e.pay).replace('.00', '') : formatHM(e.mins)}
                </Text>
              ) : (
                <View style={{ height: 12 }} />
              )}
              {e && e.count > 1 && <View style={s.multiDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, padding: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  monthTotals: { fontSize: 11, color: C.textFaint, marginTop: 2, fontVariant: ['tabular-nums'] },

  weekRow: { flexDirection: 'row', paddingBottom: 4 },
  weekday: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 10, fontWeight: '700', color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayCell: {
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayCellActive: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  dayCellToday: { borderColor: C.accent },
  dayNum: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  dayNumToday: { color: C.accent, fontWeight: '700' },
  dayHours: { fontSize: 9, color: C.accentBright, fontVariant: ['tabular-nums'] },
  multiDot: { position: 'absolute', top: 4, right: 6, width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green },
});
