import React, { useRef, useEffect, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useStyles } from '../theme/ThemeContext';

// FadeIn — mounts children with a fade + small upward translate.
// Usage: <FadeIn delay={100}>{...}</FadeIn>
export function FadeIn({ children, delay = 0, distance = 8, duration = 280, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration, delay, useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0, duration, delay, useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export function pressableScale(pressed) {
  return pressed ? { transform: [{ scale: 0.97 }], opacity: 0.92 } : null;
}

// Toast — auto-dismissing animated banner. Mount with `visible` prop.
export function Toast({ visible, message, icon = 'checkmark-circle', tone = 'success', onHide, duration = 1800 }) {
  const C = useTheme();
  const t = useStyles(makeToastStyles);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, friction: 8, tension: 90 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 90 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 120 }),
      ]).start();
      const timeoutId = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
          Animated.timing(translateY, { toValue: -12, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
          Animated.timing(scale, { toValue: 0.96, duration: 220, useNativeDriver: true }),
        ]).start(() => {
          setMounted(false);
          onHide && onHide();
        });
      }, duration);
      return () => clearTimeout(timeoutId);
    }
  }, [visible]);

  if (!mounted) return null;

  const color = tone === 'success' ? C.green : tone === 'danger' ? C.danger : C.accent;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        t.wrap,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <View style={[t.toast, { borderColor: color }]}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={t.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const makeToastStyles = (C) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  text: { color: C.text, fontSize: 14, fontWeight: '600' },
});
