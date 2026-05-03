import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';

// Dropdown
//  - Custom replacement for @react-native-picker/picker (avoids the
//    white-on-white render issue on stock Android).
//  - Accessibility: uses Pressable with accessibilityRole="button" for trigger
//    and accessibilityState selected={...} on each option.
//  - Truncates long labels in the trigger; the open list shows full text.
export default function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  style,
  triggerStyle,
  textStyle,
  compact,
  align = 'left',
  testID,
}) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: open ? 160 : 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: open ? 0 : 8,
        duration: open ? 200 : 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const label = selected ? selected.label : placeholder;

  return (
    <View style={style}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityHint="Opens a list of options"
        accessibilityLabel={`${label}, dropdown`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          s.trigger,
          compact && s.triggerCompact,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          triggerStyle,
        ]}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            s.triggerText,
            !selected && s.triggerPlaceholder,
            compact && s.triggerTextCompact,
            textStyle,
          ]}
        >
          {label}
        </Text>
        <Ionicons
          name="chevron-down"
          size={compact ? 14 : 16}
          color={C.textSubtle}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Animated.View
            style={[
              s.sheetWrap,
              { opacity: fade, transform: [{ translateY: lift }] },
            ]}
          >
            <Pressable style={[s.sheet, align === 'right' && { alignSelf: 'flex-end' }]} onPress={() => {}}>
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {options.map((opt) => {
                  const isSel = opt.value === value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                      onPress={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        s.item,
                        isSel && s.itemSelected,
                        pressed && s.itemPressed,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.itemText, isSel && s.itemTextSelected]} numberOfLines={1}>
                          {opt.label}
                        </Text>
                        {opt.sublabel ? (
                          <Text style={s.itemSub} numberOfLines={1}>{opt.sublabel}</Text>
                        ) : null}
                      </View>
                      {isSel && (
                        <Ionicons name="checkmark" size={18} color={C.accent} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingRight: 8,
    height: 44,
    gap: 6,
  },
  triggerCompact: { height: 40, paddingHorizontal: 10 },
  triggerText: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: '500',
  },
  triggerTextCompact: { fontSize: 13 },
  triggerPlaceholder: { color: C.textDim, fontWeight: '400' },

  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 380,
  },
  sheet: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  itemPressed: { backgroundColor: C.surfaceHov },
  itemSelected: { backgroundColor: C.accentBg },
  itemText: { color: C.text, fontSize: 15, fontWeight: '500' },
  itemTextSelected: { color: C.accentBright, fontWeight: '600' },
  itemSub: { color: C.textFaint, fontSize: 12, marginTop: 2 },
});
