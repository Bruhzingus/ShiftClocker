// Backwards-compat shim: exports the default (slate) palette as `C` so any
// non-React utility code that still imports it keeps working. UI components
// should import the live palette via `useTheme()` from ./ThemeContext, which
// updates when the user switches themes.
import { THEMES, DEFAULT_THEME_ID } from './themes';

export const C = THEMES[DEFAULT_THEME_ID];
