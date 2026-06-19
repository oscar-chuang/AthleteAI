import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import type { AnalysisRecord } from "@/lib/api";

// ─── Brand palette ────────────────────────────────────────────────────────────
// One place to update colors for the share card.  Two schemes are provided so
// the card looks polished whether the recipient's screenshot tool captures it
// on a dark or light background.

export interface ShareCardPalette {
  cardBg:      string;
  cardSurface: string;
  cardBorder:  string;
  textPrimary: string;
  textMuted:   string;
  accent:      string;
  imageOverlay: string;
}

export const SHARE_CARD_DARK: ShareCardPalette = {
  cardBg:      "#0e0e18",
  cardSurface: "#16161f",
  cardBorder:  "#22223a",
  textPrimary: "#f0f0f8",
  textMuted:   "#7878aa",
  accent:      "#6c63ff",
  imageOverlay: "#00000044",
};

export const SHARE_CARD_LIGHT: ShareCardPalette = {
  cardBg:      "#ffffff",
  cardSurface: "#f2f2f8",
  cardBorder:  "#dcdcf0",
  textPrimary: "#1a1a2e",
  textMuted:   "#6666a0",
  accent:      "#6c63ff",
  imageOverlay: "#0000001a",
};

// ─── Score bands ──────────────────────────────────────────────────────────────

const SCORE_BANDS = [
  { min: 80, color: "#22c55e", label: "Strong"     },
  { min: 65, color: "#6c63ff", label: "On Track"   },
  { min: 0,  color: "#f59e0b", label: "Focus Here" },
];

function scoreBandColor(score: number): string {
  return (SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[2]).color;
}

// ─── Sport icons ──────────────────────────────────────────────────────────────

export const SPORT_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  running:       "wind",
  swimming:      "droplet",
  cycling:       "zap",
  tennis:        "crosshair",
  football:      "circle",
  soccer:        "circle",
  basketball:    "circle",
  volleyball:    "circle",
  weightlifting: "trending-up",
  gymnastics:    "star",
  rowing:        "anchor",
  golf:          "flag",
  boxing:        "shield",
  yoga:          "heart",
};

function sportIcon(sport: string): React.ComponentProps<typeof Feather>["name"] {
  return SPORT_ICON[sport.toLowerCase()] ?? "activity";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

// ─── Static ring ──────────────────────────────────────────────────────────────
// No animation — view-shot captures a frozen frame, so Animated values would
// render at their initial position.

function StaticRing({
  score,
  size = 88,
  strokeWidth = 7,
  color,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const r          = (size - strokeWidth) / 2;
  const circ       = 2 * Math.PI * r;
  const clamped    = Math.min(100, Math.max(0, score));
  const dashOffset = circ * (1 - clamped / 100);
  const center     = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={center} cy={center} r={r}
          stroke={color + "28"}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center} cy={center} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color, lineHeight: 26 }}>
          {Math.round(clamped)}
        </Text>
        <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: color + "aa", marginTop: 1 }}>
          OVERALL
        </Text>
      </View>
    </View>
  );
}

// ─── Metrics list ─────────────────────────────────────────────────────────────

const METRICS: { key: keyof AnalysisRecord; label: string }[] = [
  { key: "techniqueScore",   label: "Technique"   },
  { key: "powerScore",       label: "Power"       },
  { key: "balanceScore",     label: "Balance"     },
  { key: "consistencyScore", label: "Consistency" },
  { key: "mobilityScore",    label: "Mobility"    },
  { key: "speedScore",       label: "Speed"       },
];

// ─── ShareCard ────────────────────────────────────────────────────────────────

export interface ShareCardProps {
  analysis:    AnalysisRecord;
  topTip?:     string;
  /** @default "dark" */
  colorScheme?: "dark" | "light";
  /** Override the palette accent with the user's chosen theme colour. */
  accent?:      string;
}

export function ShareCard({ analysis, topTip, colorScheme = "dark", accent }: ShareCardProps) {
  const base         = colorScheme === "light" ? SHARE_CARD_LIGHT : SHARE_CARD_DARK;
  const palette      = accent ? { ...base, accent } : base;
  const overallScore = analysis.overallScore ?? 0;
  const overallColor = scoreBandColor(overallScore);
  const sportLabel   = analysis.sport.charAt(0).toUpperCase() + analysis.sport.slice(1);
  const icon         = sportIcon(analysis.sport);
  const hasThumbnail = !!analysis.thumbnailUrl;

  const s = makeStyles(palette);

  return (
    <View style={s.card} testID={`share-card-${colorScheme}`}>
      {/* ── Thumbnail / sport-icon placeholder ── */}
      <View style={s.imageWrap}>
        {hasThumbnail ? (
          <Image
            source={{ uri: analysis.thumbnailUrl }}
            style={s.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={s.thumbnailFallback}>
            <View style={s.iconCircle}>
              <Feather name={icon} size={36} color={palette.accent} />
            </View>
            <Text style={s.fallbackSport}>{sportLabel}</Text>
          </View>
        )}
        {/* Scrim so sport badge text is readable */}
        <View style={s.imageOverlay} />
        {/* Sport badge floats over image */}
        <View style={s.sportBadge}>
          <Feather name={icon} size={10} color="#fff" />
          <Text style={s.sportBadgeText}>{sportLabel}</Text>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{analysis.title}</Text>
        <Text style={s.date}>{formatDate(analysis.uploadedAt)}</Text>

        {/* Score ring + metrics grid */}
        <View style={s.scoreRow}>
          <StaticRing score={overallScore} color={overallColor} />
          <View style={s.metricsGrid}>
            {METRICS.map(({ key, label }) => {
              const val   = (analysis[key] as number | undefined) ?? 0;
              const color = scoreBandColor(val);
              return (
                <View key={key} style={s.metricItem}>
                  <Text style={[s.metricValue, { color }]}>{Math.round(val)}</Text>
                  <Text style={s.metricLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top coaching tip strip */}
        {!!topTip && (
          <View style={s.tipStrip}>
            <Feather name="message-circle" size={11} color={palette.accent} style={{ marginTop: 1 }} />
            <Text style={s.tipText} numberOfLines={2}>{topTip}</Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Branding footer */}
        <View style={s.footer}>
          <View style={s.logoMark}>
            <Feather name="activity" size={11} color={palette.accent} />
          </View>
          <Text style={s.brandText}>AthleteAI</Text>
          <Text style={s.brandSub}>· AI-powered coaching</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Dynamic styles ───────────────────────────────────────────────────────────
// Called once per render with the active palette.  React Native's StyleSheet
// caches the underlying object so this is equivalent in perf to a static sheet.

const CARD_WIDTH = 340;

function makeStyles(p: ShareCardPalette) {
  return StyleSheet.create({
    card: {
      width:           CARD_WIDTH,
      backgroundColor: p.cardBg,
      borderRadius:    20,
      overflow:        "hidden",
      borderWidth:     1,
      borderColor:     p.cardBorder,
    },

    // Image area
    imageWrap: {
      height:          170,
      backgroundColor: p.cardSurface,
    },
    thumbnail: {
      width:  "100%",
      height: "100%",
    },
    thumbnailFallback: {
      width:           "100%",
      height:          "100%",
      backgroundColor: p.cardSurface,
      alignItems:      "center",
      justifyContent:  "center",
      gap:             10,
    },
    iconCircle: {
      width:           72,
      height:          72,
      borderRadius:    36,
      backgroundColor: p.accent + "22",
      alignItems:      "center",
      justifyContent:  "center",
    },
    fallbackSport: {
      fontSize:      14,
      fontFamily:    "Inter_600SemiBold",
      color:         p.textMuted,
      letterSpacing: 0.5,
    },
    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: p.imageOverlay,
    },
    sportBadge: {
      position:          "absolute",
      top:               12,
      left:              12,
      flexDirection:     "row",
      alignItems:        "center",
      gap:               5,
      borderRadius:      20,
      paddingHorizontal: 10,
      paddingVertical:   4,
      backgroundColor:   p.accent + "cc",
    },
    sportBadgeText: {
      fontSize:   11,
      fontFamily: "Inter_700Bold",
      color:      "#fff",
    },

    // Body
    body: {
      padding: 16,
    },
    title: {
      fontSize:     17,
      fontFamily:   "Inter_700Bold",
      color:        p.textPrimary,
      marginBottom: 2,
    },
    date: {
      fontSize:     12,
      fontFamily:   "Inter_400Regular",
      color:        p.textMuted,
      marginBottom: 14,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems:    "center",
      gap:           16,
      marginBottom:  14,
    },
    metricsGrid: {
      flex:          1,
      flexDirection: "row",
      flexWrap:      "wrap",
      gap:           8,
    },
    metricItem: {
      width:      "30%",
      flexShrink: 1,
      alignItems: "flex-start",
    },
    metricValue: {
      fontSize:   16,
      fontFamily: "Inter_700Bold",
      lineHeight: 19,
    },
    metricLabel: {
      fontSize:   9,
      fontFamily: "Inter_400Regular",
      color:      p.textMuted,
      marginTop:  1,
    },
    divider: {
      height:          1,
      backgroundColor: p.cardBorder,
      marginBottom:    12,
    },

    // Tip strip
    tipStrip: {
      flexDirection:     "row",
      alignItems:        "flex-start",
      gap:               7,
      backgroundColor:   p.accent + "18",
      borderRadius:      8,
      paddingHorizontal: 10,
      paddingVertical:   8,
      marginBottom:      12,
    },
    tipText: {
      flex:       1,
      fontSize:   11,
      fontFamily: "Inter_400Regular",
      color:      p.textPrimary,
      lineHeight: 16,
    },

    // Footer
    footer: {
      flexDirection: "row",
      alignItems:    "center",
      gap:           6,
    },
    logoMark: {
      width:           20,
      height:          20,
      borderRadius:    6,
      backgroundColor: p.accent + "22",
      alignItems:      "center",
      justifyContent:  "center",
    },
    brandText: {
      fontSize:   12,
      fontFamily: "Inter_700Bold",
      color:      p.textPrimary,
    },
    brandSub: {
      fontSize:   11,
      fontFamily: "Inter_400Regular",
      color:      p.textMuted,
    },
  });
}
