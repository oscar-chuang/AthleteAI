export type AccentKey = "midnight" | "ocean" | "sunset" | "forest";

export interface AccentPalette {
  label: string;
  color: string;
}

export const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
  midnight: { label: "Midnight", color: "#6c63ff" },
  ocean:    { label: "Ocean",    color: "#0ea5e9" },
  sunset:   { label: "Sunset",   color: "#f97316" },
  forest:   { label: "Forest",   color: "#22c55e" },
};

export const DEFAULT_ACCENT: AccentKey = "midnight";

const BASE_DARK = {
  text: "#f0f0f8",
  background: "#0a0a0f",
  foreground: "#f0f0f8",
  card: "#111118",
  cardForeground: "#f0f0f8",
  primaryForeground: "#ffffff",
  secondary: "#1a1a2e",
  secondaryForeground: "#f0f0f8",
  muted: "#1e1e2e",
  mutedForeground: "#8888aa",
  accentForeground: "#ffffff",
  destructive: "#ff4d6d",
  destructiveForeground: "#ffffff",
  border: "#1e1e2e",
  input: "#1e1e2e",
  success: "#22c55e",
  warning: "#f59e0b",
  radius: 12,
};

const BASE_LIGHT = {
  text: "#0f0f1a",
  background: "#f5f5fa",
  foreground: "#0f0f1a",
  card: "#ffffff",
  cardForeground: "#0f0f1a",
  primaryForeground: "#ffffff",
  secondary: "#ededf8",
  secondaryForeground: "#0f0f1a",
  muted: "#ededf8",
  mutedForeground: "#6b6b8a",
  accentForeground: "#ffffff",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  border: "#e0e0ef",
  input: "#e0e0ef",
  success: "#16a34a",
  warning: "#d97706",
  radius: 12,
};

function applyAccent<T extends typeof BASE_DARK | typeof BASE_LIGHT>(
  base: T,
  accentKey: AccentKey,
): T & { tint: string; primary: string; accent: string } {
  const color = ACCENT_PALETTES[accentKey].color;
  return { ...base, tint: color, primary: color, accent: color };
}

export function buildDarkTheme(accent: AccentKey = DEFAULT_ACCENT) {
  return applyAccent(BASE_DARK, accent);
}

export function buildLightTheme(accent: AccentKey = DEFAULT_ACCENT) {
  return applyAccent(BASE_LIGHT, accent);
}

export const darkTheme = buildDarkTheme(DEFAULT_ACCENT);
export const lightTheme = buildLightTheme(DEFAULT_ACCENT);

const colors = {
  light: darkTheme,
  radius: 12,
};

export default colors;
