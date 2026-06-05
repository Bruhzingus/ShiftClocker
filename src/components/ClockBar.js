import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import Dropdown from './Dropdown';
import { pad2, hmFromDate } from '../utils/helpers';
import { getActiveJobs, findJob, defaultJobId } from '../utils/jobs';
import { tapMedium } from '../utils/haptics';
import { scheduleClockOutReminder, cancelClockOutReminder } from '../utils/notifications';

// Live elapsed time, accounting for any paused spans.
function elapsedMs(clock) {
  if (!clock) return 0;
  const end = clock.pausedAt || Date.now();
  return Math.max(0, end - clock.startedAt - (clock.pausedAccumMs || 0));
}

function fmtElapsed(ms) {
  const t = Math.floor(ms / 1000);
  return `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${pad2(t % 60)}`;
}

export default function ClockBar({ activeClock, setActiveClock, settings, onClockOut }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const activeJobs = getActiveJobs(settings.jobs || []);

  const [jobId, setJobId] = useState(defaultJobId(activeJobs, settings.lastUsedJobId) || '');
  const [, setTick] = useState(0); // forces a re-render each second while running

  const running = !!activeClock;
  const paused  = !!(activeClock && activeClock.pausedAt);

  // Tick once a second while running and not paused. Recompute on foreground so
  // the timer is correct after the app was backgrounded.
  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') setTick((n) => n + 1); });
    return () => { clearInterval(id); sub.remove(); };
  }, [running, paused]);

  // Pulsing dot while running.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!running || paused) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [running, paused]);

  const clockIn = () => {
    tapMedium();
    setActiveClock({ startedAt: Date.now(), jobId: jobId || null, pausedAccumMs: 0, pausedAt: null });
    const r = settings.reminders;
    if (r?.enabled && r.clockOutReminderHours > 0) {
      scheduleClockOutReminder(r.clockOutReminderHours).catch(() => {});
    }
  };

  const togglePause = () => {
    setActiveClock((c) => {
      if (!c) return c;
      if (c.pausedAt) return { ...c, pausedAccumMs: (c.pausedAccumMs || 0) + (Date.now() - c.pausedAt), pausedAt: null };
      return { ...c, pausedAt: Date.now() };
    });
  };

  const clockOut = () => {
    tapMedium();
    const c = activeClock;
    if (!c) return;
    const pausedTotal = (c.pausedAccumMs || 0) + (c.pausedAt ? Date.now() - c.pausedAt : 0);
    const startStr = hmFromDate(new Date(c.startedAt));
    const endStr   = hmFromDate(new Date());
    onClockOut({
      start: startStr,
      end: endStr,
      jobId: c.jobId || null,
      breakMinutes: Math.round(pausedTotal / 60000),
    });
    setActiveClock(null);
    cancelClockOutReminder().catch(() => {});
  };

  // ── Idle: Clock In ──
  if (!running) {
    return (
      <View style={s.idleBar}>
        {activeJobs.length > 0 && (
          <View style={s.jobPick}>
            <Dropdown
              value={jobId}
              options={activeJobs.map((j) => ({ value: j.id, label: j.name }))}
              onChange={setJobId}
              placeholder="Job"
              compact
            />
          </View>
        )}
        <Pressable
          onPress={clockIn}
          accessibilityRole="button"
          accessibilityLabel="Clock in"
          style={({ pressed }) => [s.clockInBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <Ionicons name="play" size={16} color={C.accentInk} />
          <Text style={s.clockInText}>Clock In</Text>
        </Pressable>
      </View>
    );
  }

  // ── Running ──
  const job = findJob(activeJobs, activeClock.jobId);
  return (
    <View style={[s.runBar, paused && s.runBarPaused]}>
      <View style={s.runLeft}>
        <Animated.View style={[s.liveDot, { opacity: pulse, backgroundColor: paused ? C.textFaint : C.green }]} />
        <View>
          <Text style={s.runTime}>{fmtElapsed(elapsedMs(activeClock))}</Text>
          <Text style={s.runMeta}>
            {paused ? 'Paused' : 'Running'}{job ? `  ·  ${job.name}` : ''}
          </Text>
        </View>
      </View>
      <View style={s.runActions}>
        <Pressable onPress={togglePause} accessibilityRole="button" accessibilityLabel={paused ? 'Resume' : 'Pause'}
          style={({ pressed }) => [s.pauseBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name={paused ? 'play' : 'pause'} size={16} color={C.text} />
        </Pressable>
        <Pressable onPress={clockOut} accessibilityRole="button" accessibilityLabel="Clock out"
          style={({ pressed }) => [s.clockOutBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
          <Ionicons name="stop" size={15} color={C.accentInk} />
          <Text style={s.clockOutText}>Clock Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  idleBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.borderFaint,
    padding: 8,
  },
  jobPick: { flex: 1 },
  clockInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 16, height: 44,
    marginLeft: 'auto',
  },
  clockInText: { fontSize: 14, fontWeight: '700', color: C.accentInk },

  runBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.green,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  runBarPaused: { borderColor: C.border },
  runLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  runTime: { fontSize: 22, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  runMeta: { fontSize: 11, color: C.textFaint, marginTop: 1 },
  runActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pauseBtn: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceHov, borderWidth: 1, borderColor: C.border,
  },
  clockOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 13, height: 40,
  },
  clockOutText: { fontSize: 13, fontWeight: '700', color: C.accentInk },
});
