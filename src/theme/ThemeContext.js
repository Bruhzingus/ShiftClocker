import React, { createContext, useContext, useMemo } from 'react';
import { THEMES, DEFAULT_THEME_ID } from './themes';

const ThemeContext = createContext(THEMES[DEFAULT_THEME_ID]);

export function ThemeProvider({ themeId, children }) {
  const colors = THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
  // Memo on themeId so consumers using useStyles only rebuild when the
  // theme actually changes (rather than on every parent render).
  const value = useMemo(() => colors, [themeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Pattern: define `const makeStyles = (C) => StyleSheet.create({...})` at the
// bottom of a component file, then call `const s = useStyles(makeStyles)` in
// the component body. The hook re-builds the StyleSheet whenever the active
// theme changes, so colour swaps take effect without an app restart.
export function useStyles(makeStyles) {
  const C = useTheme();
  return useMemo(() => makeStyles(C), [C, makeStyles]);
}
