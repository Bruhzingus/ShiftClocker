import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { Field, NumInput } from './common';
import { formatMoney } from '../utils/helpers';

export default function MileageSection({ shifts, settings, setSettings }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const { kmMonth, kmFortnight } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fortnightAgo = new Date(now);
    fortnightAgo.setDate(fortnightAgo.getDate() - 14);

    let kmMonth = 0, kmFortnight = 0;
    for (const sh of shifts) {
      const [y, mo, d] = (sh.date || '').split('-').map(Number);
      if (!y) continue;
      const dt = new Date(y, mo - 1, d);
      const km = Number(sh.mileageKm) || 0;
      if (dt >= monthStart) kmMonth += km;
      if (dt >= fortnightAgo) kmFortnight += km;
    }
    return { kmMonth, kmFortnight };
  }, [shifts]);

  if (!settings.trackMileage) return null;
  const rate = Number(settings.mileageRate) || 0;

  return (
    <View style={s.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="car-outline" size={16} color={C.textSubtle} />
          <Text style={s.headerLabel}>Mileage</Text>
        </View>
        <View style={s.headerRight}>
          <Text style={s.headerValue}>{kmMonth.toFixed(1)} km</Text>
          <Text style={s.headerHint}>this month</Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={C.textFaint}
          />
        </View>
      </Pressable>

      {open && (
        <View style={s.body}>
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>This month</Text>
              <Text style={s.statValue}>{kmMonth.toFixed(1)} <Text style={s.statUnit}>km</Text></Text>
              {rate > 0 && <Text style={s.statPay}>{formatMoney(kmMonth * rate)}</Text>}
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Last 14 days</Text>
              <Text style={s.statValue}>{kmFortnight.toFixed(1)} <Text style={s.statUnit}>km</Text></Text>
              {rate > 0 && <Text style={s.statPay}>{formatMoney(kmFortnight * rate)}</Text>}
            </View>
          </View>
          <Field label="Reimbursement rate" hint="$ per km">
            <NumInput
              value={settings.mileageRate ?? 0}
              onChangeText={(v) => setSettings({ ...settings, mileageRate: Number(v) || 0 })}
              placeholder="0.00"
            />
          </Field>
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderFaint,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 48,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLabel: { fontSize: 14, color: C.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerValue: { fontSize: 14, fontWeight: '500', color: C.text, fontVariant: ['tabular-nums'] },
  headerHint: { fontSize: 11, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },

  body: { padding: 14, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
  },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: C.textFaint, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 13, fontWeight: '400', color: C.textFaint },
  statPay: { fontSize: 12, color: C.accentBright, marginTop: 2, fontVariant: ['tabular-nums'] },
});
