import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, Switch,
  StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useStyles } from '../theme/ThemeContext';
import { dateFromISO, isoFromDate, hmFromDate, timeFromHM } from '../utils/helpers';

// ─── Button ─────────────────────────────────────────────────────────────────

export function Btn({ children, onPress, variant = 'secondary', style, disabled, small }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  const bg = {
    primary: C.accent,
    secondary: C.surface,
    ghost: 'transparent',
    danger: C.dangerBg,
  }[variant];
  const fg = {
    primary: C.accentInk,
    secondary: C.text,
    ghost: C.textSubtle,
    danger: C.danger,
  }[variant];

  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, {
    toValue: 0.96, useNativeDriver: true, friction: 9, tension: 200,
  }).start();
  const onOut = () => Animated.spring(scale, {
    toValue: 1, useNativeDriver: true, friction: 6, tension: 220,
  }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          s.btn,
          small && s.btnSmall,
          { backgroundColor: bg },
          variant === 'secondary' && s.btnBorder,
          variant === 'danger' && s.btnDangerBorder,
          variant === 'ghost' && s.btnGhostBorder,
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.4 },
        ]}
      >
        {typeof children === 'string' ? (
          <Text style={[s.btnText, small && s.btnTextSmall, { color: fg }]}>{children}</Text>
        ) : (
          <View style={s.btnInner}>{children}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── IconBtn ─────────────────────────────────────────────────────────────────

export function IconBtn({ children, onPress, active, style }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.iconBtn,
        active && { borderColor: C.accent },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

export function Field({ label, hint, children }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.field}>
      <View style={s.fieldHeader}>
        <Text style={s.fieldLabel}>{label}</Text>
        {hint && <Text style={s.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

// ─── StyledInput ─────────────────────────────────────────────────────────────

export function StyledInput({ style, multiline, ...props }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <TextInput
      placeholderTextColor={C.textDim}
      style={[s.input, multiline && s.inputMulti, style]}
      multiline={multiline}
      {...props}
    />
  );
}

// ─── NumInput ────────────────────────────────────────────────────────────────

export function NumInput({ value, onChangeText, style, ...props }) {
  return (
    <StyledInput
      keyboardType="decimal-pad"
      value={String(value ?? '')}
      onChangeText={onChangeText}
      style={style}
      {...props}
    />
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label, hint }) {
  const C = useTheme();
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={() => onChange(!checked)} style={s.toggle}>
      <View style={s.toggleLeft}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint && <Text style={s.toggleHint}>{hint}</Text>}
      </View>
      <Switch
        value={checked}
        onValueChange={onChange}
        trackColor={{ false: C.surfaceHov, true: C.accent }}
        thumbColor="#fff"
      />
    </Pressable>
  );
}

// ─── Date field ──────────────────────────────────────────────────────────────

export function DateField({ label, value, onChange }) {
  const s = useStyles(makeStyles);
  const [show, setShow] = useState(false);

  return (
    <Field label={label}>
      <Pressable onPress={() => setShow(true)} style={s.input}>
        <Text style={value ? s.inputText : s.inputPlaceholder}>
          {value || 'Select date'}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={dateFromISO(value)}
          mode="date"
          display="default"
          onChange={(e, date) => {
            setShow(false);
            if (date && e.type !== 'dismissed') onChange(isoFromDate(date));
          }}
        />
      )}
    </Field>
  );
}

// ─── Time field ──────────────────────────────────────────────────────────────

export function TimeField({ label, value, onChange }) {
  const s = useStyles(makeStyles);
  const [show, setShow] = useState(false);

  return (
    <Field label={label}>
      <Pressable onPress={() => setShow(true)} style={s.input}>
        <Text style={value ? s.inputText : s.inputPlaceholder}>
          {value || '--:--'}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={timeFromHM(value)}
          mode="time"
          is24Hour
          display="default"
          onChange={(e, date) => {
            setShow(false);
            if (date && e.type !== 'dismissed') onChange(hmFromDate(date));
          }}
        />
      )}
    </Field>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  const s = useStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: open ? 1 : 0,
        duration: open ? 180 : 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scale, {
        toValue: open ? 1 : 0.95,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
      }),
    ]).start();
  }, [open]);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[s.overlay, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel} />
        <Animated.View style={[s.dialog, { transform: [{ scale }] }]}>
          <Text style={s.dialogTitle}>{title}</Text>
          {message ? <Text style={s.dialogMsg}>{message}</Text> : null}
          <View style={s.dialogBtns}>
            <Btn variant="ghost" onPress={onCancel} style={{ flex: 1 }}>Cancel</Btn>
            <Btn variant={danger ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }}>
              {confirmLabel}
            </Btn>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

export function SectionCard({ children, style }) {
  const s = useStyles(makeStyles);
  return <View style={[s.sectionCard, style]}>{children}</View>;
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider() {
  const s = useStyles(makeStyles);
  return <View style={s.divider} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (C) => StyleSheet.create({
  btn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnSmall: { height: 36, paddingHorizontal: 12 },
  btnBorder: { borderWidth: 1, borderColor: C.border },
  btnDangerBorder: { borderWidth: 1, borderColor: C.dangerBorder },
  btnGhostBorder: { borderWidth: 1, borderColor: 'transparent' },
  btnText: { fontSize: 14, fontWeight: '600', color: C.text },
  btnTextSmall: { fontSize: 13 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },

  field: { gap: 6 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: C.textFaint },
  fieldHint: { fontSize: 11, color: C.textDim },

  input: {
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    color: C.text,
    fontSize: 15,
    justifyContent: 'center',
  },
  inputText: { color: C.text, fontSize: 15 },
  inputPlaceholder: { color: C.textDim, fontSize: 15 },
  inputMulti: {
    height: undefined,
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  toggleLeft: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: C.text },
  toggleHint: { fontSize: 12, color: C.textFaint, marginTop: 2 },

  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  dialogMsg: { fontSize: 14, color: C.textSubtle, marginBottom: 20, lineHeight: 20 },
  dialogBtns: { flexDirection: 'row', gap: 8 },

  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderFaint,
    padding: 16,
  },

  divider: { height: 1, backgroundColor: C.borderFaint, marginVertical: 4 },
});
