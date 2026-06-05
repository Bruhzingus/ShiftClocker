import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import ScreenContainer from '../components/ScreenContainer';
import BarChart from '../components/BarChart';
import { FadeIn } from '../components/Animated';
import { computeShift } from '../utils/calculations';
import { computePeriodRange } from '../utils/periods';
import { formatHM, formatMoney, decimalHours } from '../utils/helpers';
import { findJob } from '../utils/jobs';

const SCOPES = [
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year' },
  { id: 'all',   label: 'All' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StatsScreen({ shifts, settings, onBack }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [scope, setScope] = useState('month');

  const range = useMemo(() => (scope === 'all' ? null : computePeriodRange(scope, 0, settings)), [scope, settings]);

  const scoped = useMemo(() => {
    if (!range) return shifts;
    return shifts.filter((sh) => sh.date >= range.dateFrom && sh.date <= range.dateTo);
  }, [shifts, range]);

  const stats = useMemo(() => {
    let mins = 0, pay = 0, ot = 0, tips = 0, km = 0;
    const weekday = Array(7).fill(0);
    const jobMins = {};
    for (const sh of scoped) {
      const c = computeShift(sh, settings);
      mins += c.paidMinutes;
      pay += c.pay;
      ot += Math.round(c.otHours * 60);
      tips += Number(sh.tips) || 0;
      km += Number(sh.mileageKm) || 0;
      const [y, m, d] = sh.date.split('-').map(Number);
      weekday[new Date(y, m - 1, d).getDay()] += c.paidMinutes;
      const key = sh.jobId || '_none';
      jobMins[key] = (jobMins[key] || 0) + c.paidMinutes;
    }
    return { mins, pay, ot, tips, km, weekday, jobMins, count: scoped.length };
  }, [scoped, settings]);

  const weekStart = Number(settings.payPeriod?.weekStartDay ?? 1);
  const weekdayData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dow = (weekStart + i) % 7;
      return { label: WEEKDAYS[dow], value: stats.weekday[dow], color: C.accent };
    }), [stats.weekday, weekStart, C]);

  const jobData = useMemo(() =>
    Object.entries(stats.jobMins)
      .map(([key, v]) => {
        const job = key === '_none' ? null : findJob(settings.jobs, key);
        return { label: job ? job.name : 'Untagged', value: v, color: job?.color || C.textDim };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8), [stats.jobMins, settings.jobs, C]);

  const reimbursement = stats.km * (Number(settings.mileageRate) || 0);
  const avgMins = stats.count ? Math.round(stats.mins / stats.count) : 0;
  const avgPay  = stats.count ? stats.pay / stats.count : 0;

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={C.textSubtle} />
        </Pressable>
        <Text style={s.title}>Statistics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Scope chips */}
        <View style={s.scopeRow}>
          {SCOPES.map((sc) => {
            const on = scope === sc.id;
            return (
              <Pressable key={sc.id} onPress={() => setScope(sc.id)}
                style={[s.scopeChip, on && s.scopeChipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Text style={[s.scopeText, on && s.scopeTextOn]}>{sc.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {range && <Text style={s.rangeLabel}>{range.label}</Text>}

        {scoped.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="bar-chart-outline" size={36} color={C.textDim} />
            <Text style={s.emptyText}>No shifts in this period.</Text>
          </View>
        ) : (
          <>
            {/* Stat cards */}
            <FadeIn delay={0}>
              <View style={s.cards}>
                <Stat s={s} label="Shifts" value={String(stats.count)} />
                <Stat s={s} label="Hours" value={formatHM(stats.mins)} sub={`${decimalHours(stats.mins).toFixed(1)} h`} />
                {settings.showWage && <Stat s={s} label="Earnings" value={formatMoney(stats.pay)} accent />}
                <Stat s={s} label="Avg / shift" value={formatHM(avgMins)} sub={settings.showWage ? formatMoney(avgPay) : undefined} />
                {settings.trackOvertime && stats.ot > 0 && <Stat s={s} label="Overtime" value={formatHM(stats.ot)} />}
                {settings.showWage && stats.tips > 0 && <Stat s={s} label="Tips" value={formatMoney(stats.tips)} />}
                {settings.trackMileage && stats.km > 0 && (
                  <Stat s={s} label="Mileage" value={`${stats.km.toFixed(1)} km`} sub={reimbursement > 0 ? formatMoney(reimbursement) : undefined} />
                )}
              </View>
            </FadeIn>

            {/* Hours by weekday */}
            <FadeIn delay={60}>
              <View style={s.section}>
                <Text style={s.sectionTitle}>Hours by weekday</Text>
                <BarChart data={weekdayData} format={(v) => formatHM(Math.round(v))} />
              </View>
            </FadeIn>

            {/* By job */}
            {jobData.length > 1 && (
              <FadeIn delay={120}>
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Hours by job</Text>
                  <BarChart data={jobData} format={(v) => formatHM(Math.round(v))} />
                </View>
              </FadeIn>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ s, label, value, sub, accent }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, accent && s.statValueAccent]} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={s.statSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 56,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },

  scopeRow: { flexDirection: 'row', gap: 6 },
  scopeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt,
  },
  scopeChipOn: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  scopeText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
  scopeTextOn: { color: C.accentBright },
  rangeLabel: { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: -8 },

  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '31.5%', flexGrow: 1,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.borderFaint,
    padding: 12,
  },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: C.textFaint },
  statValue: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 4, fontVariant: ['tabular-nums'] },
  statValueAccent: { color: C.accentBright },
  statSub: { fontSize: 11, color: C.textFaint, marginTop: 2, fontVariant: ['tabular-nums'] },

  section: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.borderFaint,
    padding: 14, gap: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.textMuted },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: C.textFaint },
});
