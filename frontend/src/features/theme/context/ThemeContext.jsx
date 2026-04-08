import { createContext, useEffect, useMemo, useState } from 'react';
import { applyDocumentTheme, getStoredTheme, normalizeTheme, setStoredTheme } from '../../../utils/theme.js';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyDocumentTheme(theme);
    setStoredTheme(theme);
  }, [theme]);

  const setTheme = (nextTheme) => setThemeState(normalizeTheme(nextTheme));
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
