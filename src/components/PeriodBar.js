import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';

const TABS = [
  { id: 'all',       label: 'All' },
  { id: 'week',      label: 'Week' },
  { id: 'payperiod', label: 'Pay Period' },
  { id: 'month',     label: 'Month' },
  { id: 'year',      label: 'Year' },
];

export default function PeriodBar({ period, onPeriodChange, offset, onOffsetChange, periodRange }) {
  const C = useTheme();
  const s = useStyles(makeStyles);

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabs}
        keyboardShouldPersistTaps="handled"
      >
        {TABS.map((tab) => {
          const active = period === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => { onPeriodChange(tab.id); onOffsetChange(0); }}
              style={({ pressed }) => [s.tab, active && s.tabActive, pressed && { opacity: 0.75 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Navigation arrows live at the bottom of ShiftTable */}
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: C.accentBg,
    borderColor: C.accentBorder,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
  tabTextActive: { color: C.accentBright },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderFaint,
    gap: 8,
  },
});
