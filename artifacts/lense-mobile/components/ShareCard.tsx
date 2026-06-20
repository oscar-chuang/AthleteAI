import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { toTitleCase } from "@/utils/formatDisplay";

const ACCENT  = "#00C2FF";
const BG      = "#0e0e18";
const SURFACE = "#16161f";
const BORDER  = "#22223a";
const TEXT    = "#f0f0f8";
const MUTED   = "#7878aa";

const MAX_TIP_LEN = 80;

export interface ShareCardProps {
  sessions:    number;
  weeklyGoal:  number;
  streakDays:  number;
  sport:       string;
  topTip?:     string;
}

function truncateTip(tip: string): string {
  if (tip.length <= MAX_TIP_LEN) return tip;
  return tip.slice(0, 77) + "\u2026";
}

const SPORT_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
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

const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { sessions, weeklyGoal, streakDays, sport, topTip },
  ref,
) {
  const displayedTip = topTip ? truncateTip(topTip) : undefined;

  return (
    <View ref={ref} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>AthleteAI</Text>
        <View style={styles.sportBadge}>
          <Feather name={sportIcon(sport)} size={12} color={ACCENT} />
          <Text style={styles.sport}>{toTitleCase(sport)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{sessions}</Text>
          <Text style={styles.statLabel}>
            {sessions === 1 ? "session" : "sessions"} this week
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{weeklyGoal}</Text>
          <Text style={styles.statLabel}>weekly goal</Text>
        </View>

        {streakDays > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#ff6b35" }]}>{streakDays}</Text>
            <Text style={styles.statLabel}>day streak 🔥</Text>
          </View>
        )}
      </View>

      {displayedTip !== undefined && (
        <View style={styles.tipRow}>
          <Feather name="message-circle" size={12} color={ACCENT} />
          <View style={styles.tipContent}>
            <Text style={styles.tipLabel}>{"Coach's top tip"}</Text>
            <Text style={styles.tipText}>{displayedTip}</Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brand: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT + "18",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sport: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  stats: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 14,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  statLabel: {
    color: MUTED,
    fontSize: 11,
    marginTop: 1,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tipContent: {
    flex: 1,
  },
  tipLabel: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  tipText: {
    color: TEXT,
    fontSize: 12,
    lineHeight: 17,
  },
});
