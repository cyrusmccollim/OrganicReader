import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

import { buildTheme, ACCENT_COLORS, AccentColor, Theme } from './theme';
import { SettingsRepository } from './services/SettingsRepository';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  accent: AccentColor;
  setAccent: (v: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with sensible defaults so the app renders correctly before the
  // async storage load completes (typically < 50 ms - no visible flash).
  const [isDark, setIsDarkState] = useState(true);
  const [accent, setAccentState] = useState<AccentColor>(ACCENT_COLORS[0]);

  const theme = useMemo(() => buildTheme(isDark, accent), [isDark, accent]);

  // Load persisted settings on mount
  useEffect(() => {
    SettingsRepository.load().then(({ isDark: d, accent: a }) => {
      setIsDarkState(d);
      setAccentState(a);
    });
  }, []);

  const setIsDark = (v: boolean): void => {
    setIsDarkState(v);
    SettingsRepository.save({ isDark: v, accent });
  };

  const setAccent = (v: AccentColor): void => {
    setAccentState(v);
    SettingsRepository.save({ isDark, accent: v });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setIsDark, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme() {
  return useContext(ThemeContext);
}
