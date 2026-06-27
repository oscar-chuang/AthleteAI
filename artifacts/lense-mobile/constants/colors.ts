// Design system: Volt (#C6FF3A) on Ink (#07090B) — Nike Run Club / Apple Fitness aesthetic
const VOLT = "#C6FF3A";
const INK  = "#07090B";

const colors = {
  light: {
    // Brand
    volt:    VOLT,
    ink:     INK,

    // Surfaces (legacy aliases kept so useColors() callers don't break)
    text:            "#F5F5F5",
    background:      INK,
    foreground:      "#F5F5F5",
    card:            "#111316",      // legacy alias → surface2
    cardForeground:  "#F5F5F5",
    surface1:        INK,
    surface2:        "#111316",
    surface3:        "#1A1D21",
    surface4:        "#22262D",
    muted:           "#1A1D21",      // legacy alias → surface3, used for disabled states

    // Primary = Volt
    primary:            VOLT,
    primaryForeground:  INK,         // text ON a primary/volt button → ALWAYS ink
    tint:               VOLT,
    accent:             VOLT,
    accentForeground:   INK,

    // Semantic
    secondary:           "#1A1D21",
    secondaryForeground: "#F5F5F5",
    mutedForeground:     "#6B7280",
    border:              "#FFFFFF0D",
    borderStrong:        "#FFFFFF18",
    input:               "#1A1D21",

    // Status
    success:     "#22C55E",
    warning:     "#F59E0B",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    energy:      "#FF6B35",

    // Text hierarchy
    textPrimary:   "#F5F5F5",
    textSecondary: "#9CA3AF",
    textTertiary:  "#6B7280",
  },
  radius: 14,
};

export default colors;

export function buildDarkTheme() {
  return colors.light;
}

export function buildLightTheme() {
  return colors.light;
}
