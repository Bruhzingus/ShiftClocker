import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useAsyncStorage(key, initial) {
  const init = typeof initial === 'function' ? initial : () => initial;
  const [value, setValue] = useState(init);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (raw !== null) {
          try { setValue(JSON.parse(raw)); } catch {
            // Ignore — corrupted entries fall back to the seed value rather
            // than blocking app startup.
          }
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}

export async function clearAllStorage() {
  await AsyncStorage.multiRemove([
    'sl.shifts.v1',
    'sl.quickshifts.v1',
    'sl.settings.v1',
    'sl.sort.v1',
    'sl.theme.v1',
    'sl.activeClock.v1',
  ]);
}
