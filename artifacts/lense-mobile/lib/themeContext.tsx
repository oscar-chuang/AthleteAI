import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDarkTheme, buildLightTheme, DEFAULT_ACCENT } from "@/constants/colors";
import type { AccentKey } from "@/constants/colors";

export type ThemeMode = "dark" | "light";
export type { AccentKey };
export type ThemeColors = ReturnType<typeof buildDarkTheme>;

const STORAGE_KEY_MODE   = "theme_mode";
const STORAGE_KEY_ACCENT = "theme_accent";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  accentColor: AccentKey;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (accent: AccentKey) => void;
}

const defaultColors = buildDarkTheme(DEFAULT_ACCENT);

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  colors: defaultColors,
  isDark: true,
  accentColor: DEFAULT_ACCENT,
  toggleTheme: () => {},
  setMode: () => {},
  setAccentColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accentColor, setAccentState] = useState<AccentKey>(DEFAULT_ACCENT);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_MODE),
      AsyncStorage.getItem(STORAGE_KEY_ACCENT),
    ])
      .then(([savedMode, savedAccent]) => {
        if (savedMode === "light" || savedMode === "dark") {
          setModeState(savedMode);
        }
        if (
          savedAccent === "midnight" ||
          savedAccent === "ocean" ||
          savedAccent === "sunset" ||
          savedAccent === "forest"
        ) {
          setAccentState(savedAccent);
        }
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY_MODE, next).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY_MODE, next).catch(() => {});
      return next;
    });
  }, []);

  const setAccentColor = useCallback((accent: AccentKey) => {
    setAccentState(accent);
    AsyncStorage.setItem(STORAGE_KEY_ACCENT, accent).catch(() => {});
  }, []);

  const colors =
    mode === "dark" ? buildDarkTheme(accentColor) : buildLightTheme(accentColor);

  return (
    <ThemeContext.Provider
      value={{ mode, colors, isDark: mode === "dark", accentColor, toggleTheme, setMode, setAccentColor }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
