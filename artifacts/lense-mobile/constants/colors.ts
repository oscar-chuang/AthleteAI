const ACCENT_COLOR = "#2F7BFF";

const BASE_DARK = {
  text:                "#F0F4F8",
  background:          "#0B0D0F",
  surface1:            "#0B0D0F",
  surface2:            "#121417",
  surface3:            "#171A1F",
  surface4:            "#1E2229",
  foreground:          "#F0F4F8",
  card:                "#121417",
  cardForeground:      "#F0F4F8",
  primaryForeground:   "#ffffff",
  secondary:           "#171A1F",
  secondaryForeground: "#F0F4F8",
  muted:               "#171A1F",
  mutedForeground:     "#8A94A6",
  accentForeground:    "#ffffff",
  destructive:         "#EF4444",
  destructiveForeground: "#ffffff",
  border:              "#ffffff0d",
  borderStrong:        "#ffffff18",
  input:               "#171A1F",
  success:             "#22C55E",
  warning:             "#F59E0B",
  energy:              "#FF6B35",
  textPrimary:         "#F0F4F8",
  textSecondary:       "#9CA3AF",
  textTertiary:        "#8A94A6",
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
  mutedForeground:     "#8A94A6",
  accentForeground:    "#ffffff",
  destructive:         "#EF4444",
  destructiveForeground: "#ffffff",
  border:              "#E2E6EC",
  borderStrong:        "#CCD1DA",
  input:               "#EAEDF1",
  success:             "#22C55E",
  warning:             "#F59E0B",
  energy:              "#FF6B35",
  textPrimary:         "#0A0C0E",
  textSecondary:       "#4B5563",
  textTertiary:        "#8A94A6",
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
