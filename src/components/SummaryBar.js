import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStyles } from '../theme/ThemeContext';
import { computeShift } from '../utils/calculations';
import { formatHM, formatMoney } from '../utils/helpers';
import { AnimatedCount } from './Animated';

export default function SummaryBar({ shifts, settings }) {
  const s = useStyles(makeStyles);
  const totals = useMemo(() => {
    let mins = 0, pay = 0, km = 0;
    for (const sh of shifts) {
      const c = computeShift(sh, settings);
      mins += c.paidMinutes;
      pay += c.pay;
      km += Number(sh.mileageKm) || 0;
    }
    return { mins, pay, km };
  }, [shifts, settings]);

  return (
    <View style={s.bar}>
      <Text style={s.count}>{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</Text>
      <Text style={s.dot}>·</Text>
      <AnimatedCount value={totals.mins} format={(n) => formatHM(Math.round(n))} style={s.hours} />
      {settings.showWage && (
        <>
          <Text style={s.dot}>·</Text>
          <AnimatedCount value={totals.pay} format={(n) => formatMoney(n)} style={s.pay} />
        </>
      )}
      {settings.trackMileage && totals.km > 0 && (
        <>
          <Text style={s.dot}>·</Text>
          <Text style={s.km}>{totals.km.toFixed(1)} km</Text>
        </>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  count: { fontSize: 13, color: C.textFaint },
  dot: { fontSize: 13, color: C.textDim },
  hours: { fontSize: 13, color: C.textMuted, fontWeight: '500', fontVariant: ['tabular-nums'] },
  pay: { fontSize: 13, color: C.accentBright, fontWeight: '500', fontVariant: ['tabular-nums'] },
  km: { fontSize: 13, color: C.textFaint, fontVariant: ['tabular-nums'] },
});
