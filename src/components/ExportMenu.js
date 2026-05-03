import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { exportCSV, exportPDF } from '../utils/export';

function MenuItem({ icon, title, subtitle, onPress }) {
  const C = useTheme();
  const m = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [m.item, pressed && m.itemPressed]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={C.textSubtle} />
      <View>
        <Text style={m.itemTitle}>{title}</Text>
        <Text style={m.itemSub}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function ExportMenu({ open, shifts, settings, summaryText, dateRangeText, onClose }) {
  const m = useStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

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

  const tryExport = async (fn) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[m.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[m.menuWrap, { transform: [{ translateY }] }]}>
          <Pressable style={m.menu} onPress={() => {}}>
            <Text style={m.menuTitle}>Export</Text>
            <View style={m.divider} />
            <MenuItem
              icon="document-text-outline"
              title="Export CSV"
              subtitle="For spreadsheets"
              onPress={() => tryExport(() => exportCSV(shifts, settings))}
            />
            <MenuItem
              icon="print-outline"
              title="Export PDF"
              subtitle="Printable report"
              onPress={() => tryExport(() => exportPDF(shifts, settings, summaryText, dateRangeText))}
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
