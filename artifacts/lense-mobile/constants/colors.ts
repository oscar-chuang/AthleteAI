const ACCENT_COLOR = "#00C2FF";

const BASE_DARK = {
  text:                "#F0F4F8",
  background:          "#0D0F11",
  surface1:            "#0D0F11",
  surface2:            "#141618",
  surface3:            "#1C1F22",
  surface4:            "#242729",
  foreground:          "#F0F4F8",
  card:                "#141618",
  cardForeground:      "#F0F4F8",
  primaryForeground:   "#ffffff",
  secondary:           "#1C1F22",
  secondaryForeground: "#F0F4F8",
  muted:               "#1C1F22",
  mutedForeground:     "#6B7280",
  accentForeground:    "#ffffff",
  destructive:         "#FF4444",
  destructiveForeground: "#ffffff",
  border:              "#ffffff0d",
  borderStrong:        "#ffffff18",
  input:               "#1C1F22",
  success:             "#1DB954",
  warning:             "#FF6B35",
  energy:              "#FF6B35",
  textPrimary:         "#F0F4F8",
  textSecondary:       "#9CA3AF",
  textTertiary:        "#6B7280",
  radius:              14,
};

const BASE_LIGHT = {
  text:                "#0A0C0E",
  background:          "#F5F7FA",
  surface1:            "#F5F7FA",
  surface2:            "#FFFFFF",
  surface3:            "#EAEDF1",
  surface4:            "#DDE1E7",
  foreground:          "#0A0C0E",
  card:                "#FFFFFF",
  cardForeground:      "#0A0C0E",
  primaryForeground:   "#ffffff",
  secondary:           "#EAEDF1",
  secondaryForeground: "#0A0C0E",
  muted:               "#EAEDF1",
  mutedForeground:     "#6B7280",
  accentForeground:    "#ffffff",
  destructive:         "#FF4444",
  destructiveForeground: "#ffffff",
  border:              "#E2E6EC",
  borderStrong:        "#CCD1DA",
  input:               "#EAEDF1",
  success:             "#1DB954",
  warning:             "#FF6B35",
  energy:              "#FF6B35",
  textPrimary:         "#0A0C0E",
  textSecondary:       "#4B5563",
  textTertiary:        "#6B7280",
  radius:              14,
};

export function buildDarkTheme() {
  return { ...BASE_DARK, tint: ACCENT_COLOR, primary: ACCENT_COLOR, accent: ACCENT_COLOR };
}

export function buildLightTheme() {
  return { ...BASE_LIGHT, tint: ACCENT_COLOR, primary: ACCENT_COLOR, accent: ACCENT_COLOR };
}

export const darkTheme  = buildDarkTheme();
export const lightTheme = buildLightTheme();

const colors = {
  light:  darkTheme,
  radius: 14,
};

export default colors;
