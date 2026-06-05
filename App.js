import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConfirmDialog } from './src/components/common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAsyncStorage, clearAllStorage } from './src/utils/storage';
import { seedShifts, seedQuickShifts, DEFAULT_SETTINGS } from './src/utils/helpers';
import { ensureJobs } from './src/utils/jobs';
import { runAutoBackup, shouldAutoBackup } from './src/utils/backup';
import { setCurrencySymbol } from './src/utils/currency';
import { syncDailyReminder } from './src/utils/notifications';
import { THEMES, DEFAULT_THEME_ID, THEME_LIST } from './src/theme/themes';
import { ThemeProvider } from './src/theme/ThemeContext';
import MainScreen from './src/screens/MainScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StatsScreen from './src/screens/StatsScreen';

export default function App() {
  const [shifts, setShifts, shiftsLoaded] = useAsyncStorage('sl.shifts.v1', seedShifts);
  const [quickShifts, setQuickShifts, qsLoaded] = useAsyncStorage('sl.quickshifts.v1', seedQuickShifts);
  const [settings, setSettings, stLoaded] = useAsyncStorage('sl.settings.v1', DEFAULT_SETTINGS);
  const [sortBy, setSortBy, sortLoaded] = useAsyncStorage('sl.sort.v1', 'date-asc');
  const [themeId, setThemeId, themeLoaded] = useAsyncStorage('sl.theme.v1', DEFAULT_THEME_ID);
  const [activeClock, setActiveClock] = useAsyncStorage('sl.activeClock.v1', null);
  const [view, setView] = useState('main');
  const [, setReloadKey] = useState(0);
  const [exitConfirm, setExitConfirm] = useState(false);

  const loaded = shiftsLoaded && qsLoaded && stLoaded && sortLoaded && themeLoaded;

  // Push the chosen currency symbol into the formatting layer synchronously so
  // formatMoney() renders the right symbol on the very first paint (and updates
  // immediately when the user changes it in Settings).
  setCurrencySymbol(settings.currency);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'main') {
        setView('main');
        return true;
      }
      setExitConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, [view]);

  // Settings backfill — once on first load, fill in any keys we added in a
  // later version, run the jobs migration, and validate the persisted theme
  // against the current theme registry. We do this in a single pass so the
  // user never sees a half-migrated UI.
  useEffect(() => {
    if (!stLoaded) return;
    let next = settings;
    let changed = false;

    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (next[k] === undefined) {
        next = { ...next, [k]: DEFAULT_SETTINGS[k] };
        changed = true;
      }
    }

    // Lazy jobs migration. If wageHistory existed and jobs is still empty,
    // ensureJobs() seeds the new shape from it; otherwise it leaves things
    // alone. We strip out the legacy keys once migrated.
    if (!Array.isArray(next.jobs) || next.jobs.length === 0) {
      const migrated = ensureJobs(next);
      next = { ...next, jobs: migrated.jobs, lastUsedJobId: next.lastUsedJobId || migrated.lastUsedJobId };
      changed = true;
    }
    if (next.wageHistory !== undefined) {
      const { wageHistory: _drop, ...rest } = next;
      next = rest;
      changed = true;
    }

    if (changed) setSettings(next);
  }, [stLoaded]);

  // Theme self-heal: if the persisted theme ID is unknown (e.g. user
  // restored a backup from a newer version that referenced a theme we no
  // longer ship), fall back to the default rather than rendering with an
  // undefined palette.
  useEffect(() => {
    if (!themeLoaded) return;
    if (!THEMES[themeId]) setThemeId(DEFAULT_THEME_ID);
  }, [themeLoaded, themeId]);

  // Auto-backup: runs once per app start, only if the configured interval
  // has elapsed. Errors are swallowed so a backup failure (e.g. no permission
  // on iOS) doesn't block normal use of the app.
  const ranAutoBackup = useRef(false);
  useEffect(() => {
    if (!loaded || ranAutoBackup.current) return;
    ranAutoBackup.current = true;
    const due = shouldAutoBackup({
      frequencyId: settings.backupFrequency,
      lastBackupAt: settings.lastBackupAt,
    });
    if (!due) return;
    (async () => {
      try {
        await runAutoBackup();
        setSettings((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
      } catch {
        // Silent — manual backup is always available.
      }
    })();
  }, [loaded]);

  // Keep the daily reminder in sync with the setting (best-effort; ignore errors
  // so a notifications failure never blocks the app).
  useEffect(() => {
    if (!loaded) return;
    syncDailyReminder(settings.reminders).catch(() => {});
  }, [loaded, settings.reminders?.enabled, settings.reminders?.time]);

  const resetAll = async () => {
    await clearAllStorage();
    setShifts(seedShifts());
    setQuickShifts(seedQuickShifts());
    setSettings(DEFAULT_SETTINGS);
    setSortBy('date-desc');
    setThemeId(DEFAULT_THEME_ID);
    setActiveClock(null);
    setView('main');
  };

  // After importBackup() rewrites AsyncStorage, we re-read each key and push
  // the value into the matching setter so the in-memory state catches up.
  const reloadFromStorage = useCallback(async () => {
    const pairs = await AsyncStorage.multiGet([
      'sl.shifts.v1', 'sl.quickshifts.v1', 'sl.settings.v1', 'sl.sort.v1', 'sl.theme.v1',
    ]);
    for (const [k, v] of pairs) {
      if (v == null) continue;
      try {
        const parsed = JSON.parse(v);
        if (k === 'sl.shifts.v1') setShifts(parsed);
        else if (k === 'sl.quickshifts.v1') setQuickShifts(parsed);
        else if (k === 'sl.settings.v1') setSettings(parsed);
        else if (k === 'sl.sort.v1') setSortBy(parsed);
        else if (k === 'sl.theme.v1') setThemeId(parsed);
      } catch {
        // Corrupt entry — leave the prior in-memory value in place.
      }
    }
    setReloadKey((n) => n + 1);
  }, []);

  const palette = THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
  const isLight = THEME_LIST.find((t) => t.id === themeId)?.isLight ?? false;

  if (!loaded) {
    return (
      <View style={[s.loading, { backgroundColor: palette.bg }]}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={palette.bg} />
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider themeId={themeId}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={palette.bg} translucent={false} />
        {view === 'settings' ? (
          <SettingsScreen
            settings={settings}
            setSettings={setSettings}
            shifts={shifts}
            setShifts={setShifts}
            quickShifts={quickShifts}
            setQuickShifts={setQuickShifts}
            themeId={themeId}
            setThemeId={setThemeId}
            onBack={() => setView('main')}
            onResetAll={resetAll}
            onAfterRestore={reloadFromStorage}
          />
        ) : view === 'stats' ? (
          <StatsScreen
            shifts={shifts}
            settings={settings}
            onBack={() => setView('main')}
          />
        ) : (
          <MainScreen
            shifts={shifts}
            setShifts={setShifts}
            quickShifts={quickShifts}
            settings={settings}
            setSettings={setSettings}
            activeClock={activeClock}
            setActiveClock={setActiveClock}
            onOpenSettings={() => setView('settings')}
            onOpenStats={() => setView('stats')}
          />
        )}
        <ConfirmDialog
          open={exitConfirm}
          title="Exit ShiftClocker?"
          message="Your data is saved automatically."
          confirmLabel="Exit"
          onConfirm={() => BackHandler.exitApp()}
          onCancel={() => setExitConfirm(false)}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
