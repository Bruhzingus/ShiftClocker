import React from 'react';
import {
  View, Platform, StatusBar, StyleSheet,
} from 'react-native';
import Constants from 'expo-constants';
import { useStyles } from '../theme/ThemeContext';

// Cross-device top inset. Uses the Expo-reported status bar height (always
// reliable on Android, falls back gracefully on iOS where SafeAreaView would
// normally cover this — we add an extra small buffer so things never tuck
// behind notches / camera punch-outs).
export const TOP_INSET =
  Platform.OS === 'android'
    ? (Constants.statusBarHeight || StatusBar.currentHeight || 24)
    : (Constants.statusBarHeight || 20);

export default function ScreenContainer({ children, style }) {
  const s = useStyles(makeStyles);
  return (
    <View style={[s.root, { paddingTop: TOP_INSET }, style]}>
      {children}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
});
