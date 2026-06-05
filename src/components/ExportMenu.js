import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Alert,
  Animated, Easing, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { DateField, NumInput } from './common';
import { exportCSV, exportPDF } from '../utils/export';
import { computePeriodRange } from '../utils/periods';
import { formatDateLong } from '../utils/helpers';

// ─── Period scopes ────────────────────────────────────────────────────────────

const SCOPES = [
  { id: 'view',      label: 'Current view' },
  { id: 'all',       label: 'All time' },
  { id: 'lastN',     label: 'Last N shifts' },
  { id: 'week',      label: 'This week' },
  { id: 'payperiod', label: 'Pay period' },
  { id: 'month',     label: 'This month' },
  { id: 'year',      label: 'This year' },
  { id: 'custom',    label: 'Custom dates' },
];

function getExportShifts(scope, viewShifts, allShifts, settings, customFrom, customTo, lastN) {
  if (scope === 'view')   return viewShifts;
  if (scope === 'all')    return allShifts;
  if (scope === 'lastN') {
    const n = Math.max(0, parseInt(lastN, 10) || 0);
    if (n === 0) return [];
    // Pick the most-recent N by date (export.js will re-sort ASC)
    const desc = [...allShifts].sort((a, b) =>
      (b.date + ' ' + (b.start || '')).localeCompare(a.date + ' ' + (a.start || ''))
    );
    return desc.slice(0, n);
  }
  if (scope === 'custom') {
    return allShifts.filter((sh) => {
      if (customFrom && sh.date < customFrom) return false;
      if (customTo   && sh.date > customTo)   return false;
      return true;
    });
  }
  const range = computePeriodRange(scope, 0, settings);
  if (!range) return allShifts;
  return allShifts.filter((sh) => sh.date >= range.dateFrom && sh.date <= range.dateTo);
}

// ─── Menu item ────────────────────────────────────────────────────────────────

function MenuItem({ icon, title, subtitle, onPress, disabled }) {
  const C = useTheme();
  const m = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [m.item, pressed && m.itemPressed, disabled && { opacity: 0.4 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={C.textSubtle} />
      <View>
        <Text style={m.itemTitle}>{title}</Text>
        <Text style={m.itemSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExportMenu({ open, viewShifts, allShifts, settings, onClose }) {
  const C = useTheme();
  const m = useStyles(makeStyles);
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [scope, setScope]           = useState('view');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [lastN,      setLastN]      = useState('20');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: open ? 1 : 0, duration: open ? 200 : 140,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: open ? 0 : 20, duration: open ? 240 : 140,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  // Reset scope each time the menu opens
  useEffect(() => {
    if (open) { setScope('view'); setCustomFrom(''); setCustomTo(''); setLastN('20'); }
  }, [open]);

  const exportShifts = useMemo(
    () => getExportShifts(scope, viewShifts, allShifts, settings, customFrom, customTo, lastN),
    [scope, viewShifts, allShifts, settings, customFrom, customTo, lastN],
  );

  const countLabel = useMemo(() => {
    const n = exportShifts.length;
    if (n === 0) return 'No shifts in this range';
    const dates = exportShifts.map((s) => s.date).sort();
    const lo = formatDateLong(dates[0]);
    const hi = formatDateLong(dates[dates.length - 1]);
    const span = dates[0] === dates[dates.length - 1] ? lo : `${lo} – ${hi}`;
    return `${n} shift${n !== 1 ? 's' : ''} · ${span}`;
  }, [exportShifts]);

  const tryExport = async (fn) => {
    try { await fn(); }
    catch (e) { Alert.alert('Export failed', e.message); }
    onClose();
  };

  const scopeLabel = SCOPES.find((sc) => sc.id === scope)?.label || '';
  const summaryForPDF = `${exportShifts.length} shift${exportShifts.length !== 1 ? 's' : ''}`;
  const dateRangeForPDF = exportShifts.length > 0
    ? (() => {
        const dates = exportShifts.map((s) => s.date).sort();
        return `${formatDateLong(dates[0])} — ${formatDateLong(dates[dates.length - 1])}`;
      })()
    : '';

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[m.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[m.menuWrap, { transform: [{ translateY }] }]}>
          <Pressable style={m.menu} onPress={() => {}}>
            {/* Title */}
            <Text style={m.menuTitle}>Export</Text>
            <View style={m.divider} />

            {/* Period scope selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={m.scopeRow}
              keyboardShouldPersistTaps="handled"
            >
              {SCOPES.map((sc) => {
                const active = scope === sc.id;
                return (
                  <Pressable
                    key={sc.id}
                    onPress={() => setScope(sc.id)}
                    style={({ pressed }) => [
                      m.scopeChip,
                      active && m.scopeChipActive,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={[m.scopeLabel, active && m.scopeLabelActive]}>
                      {sc.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Custom date pickers — shown only when "Custom dates" is selected */}
            {scope === 'custom' && (
              <View style={m.customDateRow}>
                <View style={{ flex: 1 }}>
                  <DateField label="From" value={customFrom} onChange={setCustomFrom} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="To" value={customTo} onChange={setCustomTo} />
                </View>
              </View>
            )}

            {/* Last N number input — shown only when "Last N shifts" is selected */}
            {scope === 'lastN' && (
              <View style={m.lastNRow}>
                <Text style={m.lastNLabel}>How many most-recent shifts?</Text>
                <View style={m.lastNInput}>
                  <NumInput value={lastN} onChangeText={setLastN} placeholder="20" />
                </View>
              </View>
            )}

            {/* Count badge */}
            <View style={m.countRow}>
              <Ionicons name="calendar-outline" size={13} color={C.textFaint} />
              <Text style={m.countText} numberOfLines={1}>{countLabel}</Text>
            </View>

            <View style={m.divider} />

            {/* Export formats */}
            <MenuItem
              icon="document-text-outline"
              title="Export CSV"
              subtitle="For spreadsheets"
              disabled={exportShifts.length === 0}
              onPress={() => tryExport(() => exportCSV(exportShifts, settings, scopeLabel))}
            />
            <MenuItem
              icon="print-outline"
              title="Export PDF"
              subtitle="Printable report"
              disabled={exportShifts.length === 0}
              onPress={() => tryExport(() => exportPDF(exportShifts, settings, summaryForPDF, dateRangeForPDF, scopeLabel))}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  menuWrap: {},
  menu: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, color: C.textFaint,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  divider: { height: 1, backgroundColor: C.borderFaint, marginHorizontal: 16 },

  // Scope chips
  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceAlt,
  },
  scopeChipActive: {
    backgroundColor: C.accentBg,
    borderColor: C.accentBorder,
  },
  scopeLabel: { fontSize: 12, fontWeight: '600', color: C.textFaint },
  scopeLabelActive: { color: C.accentBright },

  // Custom date picker row
  customDateRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // Last-N input row
  lastNRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  lastNLabel: { flex: 1, fontSize: 13, color: C.textSubtle },
  lastNInput: { width: 100 },

  // Count row
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  countText: { fontSize: 12, color: C.textFaint, flex: 1 },

  // Format items
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemPressed: { backgroundColor: C.surfaceHov },
  itemTitle: { fontSize: 15, fontWeight: '500', color: C.text },
  itemSub: { fontSize: 12, color: C.textFaint, marginTop: 1 },
});
