import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import type { AnalysisRecord } from "@/lib/api";

// Fixed dark palette so the card always looks polished regardless of user theme
const CARD_BG      = "#0e0e18";
const CARD_SURFACE = "#16161f";
const CARD_BORDER  = "#22223a";
const TEXT_PRIMARY = "#f0f0f8";
const TEXT_MUTED   = "#7878aa";
const ACCENT       = "#6c63ff";

const SCORE_BANDS = [
  { min: 80, color: "#22c55e", label: "Strong"     },
  { min: 65, color: "#6c63ff", label: "On Track"   },
  { min: 0,  color: "#f59e0b", label: "Focus Here" },
];

function scoreBandColor(score: number): string {
  return (SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[2]).color;
}

const SPORT_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  running:      "wind",
  swimming:     "droplet",
  cycling:      "zap",
  tennis:       "crosshair",
  football:     "circle",
  soccer:       "circle",
  basketball:   "circle",
  volleyball:   "circle",
  weightlifting:"trending-up",
  gymnastics:   "star",
  rowing:       "anchor",
  golf:         "flag",
  boxing:       "shield",
  yoga:         "heart",
};

function sportIcon(sport: string): React.ComponentProps<typeof Feather>["name"] {
  const key = sport.toLowerCase();
  return SPORT_ICON[key] ?? "activity";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

// Mini ring — static (no animation) so view-shot captures correctly
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
  const r           = (size - strokeWidth) / 2;
  const circ        = 2 * Math.PI * r;
  const clamped     = Math.min(100, Math.max(0, score));
  const dashOffset  = circ * (1 - clamped / 100);
  const center      = size / 2;
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

const METRICS: { key: keyof AnalysisRecord; label: string }[] = [
  { key: "techniqueScore",    label: "Technique"   },
  { key: "powerScore",        label: "Power"       },
  { key: "balanceScore",      label: "Balance"     },
  { key: "consistencyScore",  label: "Consistency" },
  { key: "mobilityScore",     label: "Mobility"    },
  { key: "speedScore",        label: "Speed"       },
];

interface Props {
  analysis: AnalysisRecord;
  topTip?: string;
}

export function ShareCard({ analysis, topTip }: Props) {
  const overallScore  = analysis.overallScore ?? 0;
  const overallColor  = scoreBandColor(overallScore);
  const sportLabel    = analysis.sport.charAt(0).toUpperCase() + analysis.sport.slice(1);
  const icon          = sportIcon(analysis.sport);
  const hasThumbnail  = !!analysis.thumbnailUrl;

  return (
    <View style={styles.card}>
      {/* ── Thumbnail or sport-icon placeholder ── */}
      <View style={styles.imageWrap}>
        {hasThumbnail ? (
          <Image
            source={{ uri: analysis.thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnailFallback, { backgroundColor: CARD_SURFACE }]}>
            <View style={[styles.iconCircle, { backgroundColor: ACCENT + "22" }]}>
              <Feather name={icon} size={36} color={ACCENT} />
            </View>
            <Text style={styles.fallbackSport}>{sportLabel}</Text>
          </View>
        )}
        {/* Gradient overlay so text on top is readable */}
        <View style={styles.imageOverlay} />
        {/* Sport badge floats over image */}
        <View style={[styles.sportBadge, { backgroundColor: ACCENT + "cc" }]}>
          <Feather name={icon} size={10} color="#fff" />
          <Text style={styles.sportBadgeText}>{sportLabel}</Text>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Title + date */}
        <Text style={styles.title} numberOfLines={1}>{analysis.title}</Text>
        <Text style={styles.date}>{formatDate(analysis.uploadedAt)}</Text>

        {/* Score row */}
        <View style={styles.scoreRow}>
          <StaticRing score={overallScore} color={overallColor} />
          <View style={styles.metricsGrid}>
            {METRICS.map(({ key, label }) => {
              const val   = (analysis[key] as number | undefined) ?? 0;
              const color = scoreBandColor(val);
              return (
                <View key={key} style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color }]}>{Math.round(val)}</Text>
                  <Text style={styles.metricLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top coaching tip strip */}
        {!!topTip && (
          <View style={styles.tipStrip}>
            <Feather name="message-circle" size={11} color={ACCENT} style={{ marginTop: 1 }} />
            <Text style={styles.tipText} numberOfLines={2}>{topTip}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: CARD_BORDER }]} />

        {/* Branding footer */}
        <View style={styles.footer}>
          <View style={[styles.logoMark, { backgroundColor: ACCENT + "22" }]}>
            <Feather name="activity" size={11} color={ACCENT} />
          </View>
          <Text style={styles.brandText}>AthleteAI</Text>
          <Text style={styles.brandSub}>· AI-powered coaching</Text>
        </View>
      </View>
    </View>
  );
}

const CARD_WIDTH = 340;

const styles = StyleSheet.create({
  card: {
    width:         CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius:  20,
    overflow:      "hidden",
    borderWidth:   1,
    borderColor:   CARD_BORDER,
  },

  // Image area
  imageWrap: {
    height: 170,
    backgroundColor: CARD_SURFACE,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailFallback: {
    width:          "100%",
    height:         "100%",
    alignItems:     "center",
    justifyContent: "center",
    gap:            10,
  },
  iconCircle: {
    width:          72,
    height:         72,
    borderRadius:   36,
    alignItems:     "center",
    justifyContent: "center",
  },
  fallbackSport: {
    fontSize:    14,
    fontFamily:  "Inter_600SemiBold",
    color:       TEXT_MUTED,
    letterSpacing: 0.5,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000044",
  },
  sportBadge: {
    position:       "absolute",
    top:            12,
    left:           12,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            5,
    borderRadius:   20,
    paddingHorizontal: 10,
    paddingVertical:   4,
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
    fontSize:   17,
    fontFamily: "Inter_700Bold",
    color:      TEXT_PRIMARY,
    marginBottom: 2,
  },
  date: {
    fontSize:   12,
    fontFamily: "Inter_400Regular",
    color:      TEXT_MUTED,
    marginBottom: 14,
  },
  scoreRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            16,
    marginBottom:   14,
  },
  metricsGrid: {
    flex:       1,
    flexDirection: "row",
    flexWrap:   "wrap",
    gap:        8,
  },
  metricItem: {
    width:          "30%",
    flexShrink:     1,
    alignItems:     "flex-start",
  },
  metricValue: {
    fontSize:   16,
    fontFamily: "Inter_700Bold",
    lineHeight: 19,
  },
  metricLabel: {
    fontSize:   9,
    fontFamily: "Inter_400Regular",
    color:      TEXT_MUTED,
    marginTop:  1,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },

  // Tip strip
  tipStrip: {
    flexDirection:    "row",
    alignItems:       "flex-start",
    gap:              7,
    backgroundColor:  ACCENT + "18",
    borderRadius:     8,
    paddingHorizontal: 10,
    paddingVertical:   8,
    marginBottom:     12,
  },
  tipText: {
    flex:       1,
    fontSize:   11,
    fontFamily: "Inter_400Regular",
    color:      TEXT_PRIMARY,
    lineHeight: 16,
  },

  // Footer
  footer: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            6,
  },
  logoMark: {
    width:          20,
    height:         20,
    borderRadius:   6,
    alignItems:     "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize:   12,
    fontFamily: "Inter_700Bold",
    color:      TEXT_PRIMARY,
  },
  brandSub: {
    fontSize:   11,
    fontFamily: "Inter_400Regular",
    color:      TEXT_MUTED,
  },
});
