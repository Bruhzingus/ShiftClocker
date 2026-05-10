import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { DateField } from './common';

// Simplified: search on top, date filter below. Sort removed (column headers handle it).
export default function FilterBar({
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  onClear,
  periodActive,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [dateOpen, setDateOpen] = useState(false);
  const hasFilter = !!(search || dateFrom || dateTo);

  const expand = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(expand, {
      toValue: dateOpen ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dateOpen]);

  return (
    <View style={s.wrap}>
      {/* Search row */}
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
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button">
              <Ionicons name="close-circle" size={16} color={C.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {!periodActive && (
          <Pressable
            onPress={() => setDateOpen((o) => !o)}
            style={({ pressed }) => [
              s.calBtn,
              (dateOpen || dateFrom || dateTo) && s.calBtnActive,
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Toggle date filter"
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={(dateOpen || dateFrom || dateTo) ? C.accent : C.textSubtle}
            />
          </Pressable>
        )}

        {hasFilter && (
          <Pressable onPress={onClear} style={s.clearBtn} accessibilityRole="button">
            <Text style={s.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Date filter (expands below search) */}
      {!periodActive && (
        <Animated.View style={{
          maxHeight: expand.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }),
          opacity: expand,
          overflow: 'hidden',
        }}>
          <View style={s.dateRow}>
            <View style={{ flex: 1 }}>
              <DateField label="From" value={dateFrom} onChange={setDateFrom} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField label="To" value={dateTo} onChange={setDateTo} />
            </View>
          </View>
        </Animated.View>
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
    flex: 1, color: C.text, fontSize: 14, height: 40, paddingVertical: 0,
  },
  calBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceAlt, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
  },
  calBtnActive: { borderColor: C.accentBorder, backgroundColor: C.accentBg },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 8 },
  clearText: { fontSize: 12, color: C.accent, fontWeight: '600' },
  dateRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 8, paddingBottom: 10, paddingTop: 2,
  },
});
