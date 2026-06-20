import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "@/lib/themeContext";
import { buildDarkTheme, buildLightTheme } from "@/constants/colors";

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

describe("ThemeProvider — default colors", () => {
  it("provides dark theme colors by default", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    const expected = buildDarkTheme();
    expect(result.current.colors.primary).toBe(expected.primary);
    expect(result.current.colors.accent).toBe(expected.accent);
    expect(result.current.colors.tint).toBe(expected.tint);
  });

  it("isDark is true by default", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(true);
  });

  it("mode is 'dark' by default", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("dark");
  });
});

describe("ThemeProvider — setMode", () => {
  it("switches to light mode and persists", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.setMode("light"); });

    expect(result.current.isDark).toBe(false);
    expect(result.current.mode).toBe("light");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme_mode", "light");
  });

  it("light mode uses light theme colors", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.setMode("light"); });

    const expected = buildLightTheme();
    expect(result.current.colors.primary).toBe(expected.primary);
    expect(result.current.colors.background).toBe(expected.background);
  });
});

describe("ThemeProvider — toggleTheme", () => {
  it("toggles from dark to light", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.toggleTheme(); });

    expect(result.current.isDark).toBe(false);
    expect(result.current.mode).toBe("light");
  });

  it("toggles from light back to dark", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => { result.current.setMode("light"); });
    await act(async () => { result.current.toggleTheme(); });

    expect(result.current.isDark).toBe(true);
    expect(result.current.mode).toBe("dark");
  });
});
