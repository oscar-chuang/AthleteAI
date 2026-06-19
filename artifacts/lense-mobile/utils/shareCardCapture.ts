import type { ViewStyle } from "react-native";

// ─── captureRef options ───────────────────────────────────────────────────────
// Passed verbatim to react-native-view-shot's captureRef().
// Exported so tests can assert on the real options used in production.

export const SHARE_CARD_CAPTURE_OPTIONS = {
  format:  "png",
  quality: 1,
  result:  "tmpfile",
} as const;

// ─── Hidden-view style ────────────────────────────────────────────────────────
// The ShareCard view must stay WITHIN window bounds on Android.
// Off-screen placement (e.g. top: -9999) causes the compositor to skip the
// view, producing a blank PNG.  We hide it with opacity: 0 and disable
// pointer events at the JSX layer instead.
//
// Rule: top and left must be >= 0.  opacity must be 0 to remain invisible.

export const HIDDEN_SHARE_CARD_STYLE: ViewStyle = {
  position: "absolute",
  top:      0,
  left:     0,
  opacity:  0,
} as const;
