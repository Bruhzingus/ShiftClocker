import React, { useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated } from 'react-native';
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

  // Sliding active-tab indicator. We measure each tab's layout, then spring an
  // absolutely-positioned pill to the active tab's x / width.
  const [layouts, setLayouts] = useState({});
  const indX = useRef(new Animated.Value(0)).current;
  const indW = useRef(new Animated.Value(0)).current;

  const active = layouts[period];
  useEffect(() => {
    if (!active) return;
    Animated.parallel([
      Animated.spring(indX, { toValue: active.x, useNativeDriver: false, friction: 10, tension: 120 }),
      Animated.spring(indW, { toValue: active.width, useNativeDriver: false, friction: 10, tension: 120 }),
    ]).start();
  }, [period, active]);

  const onTabLayout = (id) => (e) => {
    const { x, width, y, height } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const p = prev[id];
      if (p && p.x === x && p.width === width) return prev;
      return { ...prev, [id]: { x, width, y, height } };
    });
  };

  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.tabsInner}>
          {active && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.indicator,
                { transform: [{ translateX: indX }], width: indW, top: active.y, height: active.height },
              ]}
            />
          )}
          {TABS.map((tab) => {
            const isActive = period === tab.id;
            return (
              <Pressable
                key={tab.id}
                onLayout={onTabLayout(tab.id)}
                onPress={() => { onPeriodChange(tab.id); onOffsetChange(0); }}
                style={({ pressed }) => [s.tab, pressed && { opacity: 0.75 }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
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
  scroll: { paddingHorizontal: 6, paddingVertical: 6 },
  tabsInner: { flexDirection: 'row', gap: 4, position: 'relative' },
  indicator: {
    position: 'absolute',
    backgroundColor: C.accentBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
  tabTextActive: { color: C.accentBright },
});
