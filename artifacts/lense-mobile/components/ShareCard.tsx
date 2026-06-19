import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

const ACCENT  = "#6c63ff";
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
  return tip.slice(0, 77) + "…";
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
        <Text style={styles.sport}>{sport}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sessions}</Text>
          <Text style={styles.statLabel}>sessions</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{weeklyGoal}</Text>
          <Text style={styles.statLabel}>weekly goal</Text>
        </View>
        {streakDays > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{streakDays}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
        )}
      </View>

      {displayedTip !== undefined && (
        <View style={styles.tipRow}>
          <Feather name="message-circle" size={12} color={ACCENT} />
          <View style={styles.tipTextWrap}>
            <Text style={styles.tipLabel}>Coach's top tip</Text>
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
    width: 300,
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
  },
  sport: {
    color: MUTED,
    fontSize: 12,
    textTransform: "capitalize",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    marginTop: 2,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 12,
  },
  tipTextWrap: {
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
