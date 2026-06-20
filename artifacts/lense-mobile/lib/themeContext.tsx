import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildDarkTheme, buildLightTheme } from "@/constants/colors";

export type ThemeMode = "dark" | "light";
export type ThemeColors = ReturnType<typeof buildDarkTheme>;

const STORAGE_KEY_MODE = "theme_mode";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const defaultColors = buildDarkTheme();

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  colors: defaultColors,
  isDark: true,
  toggleTheme: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_MODE)
      .then((savedMode) => {
        if (savedMode === "light" || savedMode === "dark") {
          setModeState(savedMode);
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

  const colors = mode === "dark" ? buildDarkTheme() : buildLightTheme();

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark: mode === "dark", toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
