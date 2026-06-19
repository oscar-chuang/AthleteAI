import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "@/lib/themeContext";
import { ACCENT_PALETTES, buildDarkTheme } from "@/constants/colors";
import type { AccentKey } from "@/constants/colors";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  (AsyncStorage.setItem as jest.Mock).mockClear();
  (AsyncStorage.getItem as jest.Mock).mockClear();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe("ThemeProvider — setAccentColor persists to AsyncStorage", () => {
  it.each(Object.keys(ACCENT_PALETTES) as AccentKey[])(
    'stores "%s" under "theme_accent"',
    async (key) => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        result.current.setAccentColor(key);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme_accent", key);
    },
  );
});

describe("ThemeProvider — setAccentColor rebuilds colors immediately", () => {
  it.each(Object.keys(ACCENT_PALETTES) as AccentKey[])(
    'colors.primary/accent/tint all equal the "%s" palette color',
    async (key) => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        result.current.setAccentColor(key);
      });

      const expected = ACCENT_PALETTES[key].color;
      expect(result.current.colors.primary).toBe(expected);
      expect(result.current.colors.accent).toBe(expected);
      expect(result.current.colors.tint).toBe(expected);
    },
  );
});

describe("ThemeProvider — setAccentColor updates accentColor state", () => {
  it("exposes the updated accentColor key after calling setAccentColor", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setAccentColor("ocean");
    });

    expect(result.current.accentColor).toBe("ocean");
  });

  it("reflects successive accent changes correctly", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.setAccentColor("sunset"); });
    expect(result.current.accentColor).toBe("sunset");
    expect(result.current.colors.primary).toBe(ACCENT_PALETTES.sunset.color);

    await act(async () => { result.current.setAccentColor("forest"); });
    expect(result.current.accentColor).toBe("forest");
    expect(result.current.colors.primary).toBe(ACCENT_PALETTES.forest.color);
  });
});

describe("ThemeProvider — setAccentColor in light mode", () => {
  it("rebuilds light-mode colors with the chosen accent", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.setMode("light"); });
    await act(async () => { result.current.setAccentColor("ocean"); });

    const expected = ACCENT_PALETTES.ocean.color;
    expect(result.current.colors.primary).toBe(expected);
    expect(result.current.colors.accent).toBe(expected);
    expect(result.current.colors.tint).toBe(expected);
  });
});
