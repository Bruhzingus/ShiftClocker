import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { DateField } from './common';
import Dropdown from './Dropdown';

const SORT_OPTIONS = [
  { label: 'Date — newest first', value: 'date-desc' },
  { label: 'Date — oldest first', value: 'date-asc' },
  { label: 'Hours — most first', value: 'hours-desc' },
  { label: 'Pay — highest first', value: 'pay-desc' },
];

export default function FilterBar({
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  sortBy, setSortBy,
  onClear,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [dateOpen, setDateOpen] = useState(false);
  const hasFilter = !!(search || dateFrom || dateTo);

  const expand = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(expand, {
      toValue: dateOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dateOpen]);

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.textFaint} />
          <TextInput
            style={s.searchInput}
            placeholder="Search notes or tags"
            placeholderTextColor={C.textDim}
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Search shifts"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={C.textFaint} />
            </Pressable>
          ) : null}
        </View>

        <Dropdown
          value={sortBy}
          options={SORT_OPTIONS}
          onChange={setSortBy}
          compact
          style={s.sortWrap}
          triggerStyle={s.sortTrigger}
        />

        <Pressable
          onPress={() => setDateOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Toggle date filter"
          accessibilityState={{ expanded: dateOpen }}
          style={({ pressed }) => [
            s.calBtn,
            (dateOpen || dateFrom || dateTo) && s.calBtnActive,
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={(dateOpen || dateFrom || dateTo) ? C.accent : C.textSubtle}
          />
        </Pressable>
      </View>

      <Animated.View
        style={{
          maxHeight: expand.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }),
          opacity: expand,
          overflow: 'hidden',
        }}
      >
        <View style={s.dateRow}>
          <View style={{ flex: 1 }}>
            <DateField label="From" value={dateFrom} onChange={setDateFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="To" value={dateTo} onChange={setDateTo} />
          </View>
          {hasFilter && (
            <Pressable onPress={onClear} style={s.clearBtn} accessibilityRole="button">
              <Text style={s.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    height: 40,
    paddingVertical: 0,
  },
  sortWrap: {
    width: 130,
  },
  sortTrigger: {
    height: 40,
    paddingHorizontal: 10,
  },
  calBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  calBtnActive: { borderColor: C.accentBorder, backgroundColor: C.accentBg },

  dateRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontSize: 13, color: C.accent, fontWeight: '600' },
});
