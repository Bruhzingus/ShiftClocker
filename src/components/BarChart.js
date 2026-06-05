import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useStyles } from '../theme/ThemeContext';

// Minimal horizontal bar chart built from plain Views — no SVG/chart deps.
// data: [{ label, value, color? }]. `format` turns a value into its right-side label.
export default function BarChart({ data, format = (v) => String(Math.round(v)) }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const max = Math.max(1, ...data.map((d) => d.value || 0));

  return (
    <View style={s.wrap}>
      {data.map((d, i) => {
        const pct = Math.max(0, Math.min(1, (d.value || 0) / max));
        return (
          <View key={d.label + i} style={s.row}>
            <Text style={s.label} numberOfLines={1}>{d.label}</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: d.color || C.accent }]} />
            </View>
            <Text style={s.value} numberOfLines={1}>{format(d.value || 0)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 44, fontSize: 11, color: C.textSubtle, fontWeight: '600' },
  track: { flex: 1, height: 18, backgroundColor: C.surfaceAlt, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, minWidth: 2 },
  value: { width: 72, fontSize: 11, color: C.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
