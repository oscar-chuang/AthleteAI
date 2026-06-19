// ─── Cross-platform capture note ─────────────────────────────────────────────
// This component is rendered off-screen so it can be captured by
// react-native-view-shot without being visible to the user.
//
// Android quirk: if the wrapping View is positioned outside the window bounds
// (e.g. top: -1000), the compositor skips it and captureRef / capture() returns
// a blank PNG.  The caller MUST use HIDDEN_SHARE_CARD_STYLE from
// utils/shareCardCapture.ts (top: 0, left: 0, opacity: 0) so the view stays
// within the window hierarchy while remaining invisible and non-interactive.
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, useRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import { Feather } from "@expo/vector-icons";
import appColors from "@/constants/colors";

export interface ShareCardProps {
  sessions: number;
  weeklyGoal: number;
  streakDays: number;
  sport?: string;
  topTip?: string;
}

export interface ViewShotHandle {
  capture: () => Promise<string>;
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 430;

const t = appColors.light;
const GOLD = t.warning;
const GOLD_DIM = "#b45309";
const STREAK_ORANGE = "#ff6b35";

const s = StyleSheet.create({
  shot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: t.background,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: t.background,
    overflow: "hidden",
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: GOLD,
  },
  cornerGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: GOLD + "18",
  },
  bottomGlow: {
    position: "absolute",
    bottom: -80,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: t.primary + "14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 8,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  logoIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: t.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: t.primary,
    letterSpacing: 2,
  },
  weekBadge: {
    backgroundColor: t.secondary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: t.primary + "44",
  },
  weekBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: t.primary,
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  trophyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: GOLD,
    backgroundColor: GOLD + "1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  goalLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: GOLD_DIM,
    textTransform: "uppercase",
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  sessionsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 6,
  },
  sessionsNum: {
    fontSize: 68,
    fontFamily: "Inter_700Bold",
    color: t.foreground,
    lineHeight: 72,
  },
  sessionsOf: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
    color: t.mutedForeground,
    marginBottom: 10,
  },
  sessionsLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: t.mutedForeground,
    marginBottom: 22,
    letterSpacing: 0.3,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  sportPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: t.primary + "22",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: t.primary + "55",
  },
  sportText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: t.primary,
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: STREAK_ORANGE + "22",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: STREAK_ORANGE + "55",
  },
  streakText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: STREAK_ORANGE,
  },
  divider: {
    height: 1,
    backgroundColor: t.muted,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: t.mutedForeground,
    letterSpacing: 0.3,
  },
  footerHighlight: {
    color: t.primary,
    fontFamily: "Inter_600SemiBold",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: t.primary + "0f",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: t.primary + "33",
  },
  tipLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: t.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  tipText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: t.foreground,
    lineHeight: 15,
    flex: 1,
  },
  checkDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: t.background,
  },
});

const ShareCard = forwardRef<ViewShotHandle, ShareCardProps>(
  ({ sessions, weeklyGoal, streakDays, sport, topTip }, ref) => {
    const shotRef = useRef<ViewShotRef>(null);

    useImperativeHandle(ref, () => ({
      capture: () => shotRef.current!.capture(),
    }));

    const weekLabel = new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    return (
      <ViewShot ref={shotRef} style={s.shot} options={{ format: "png", quality: 1 }}>
        <View style={s.card}>
          <View style={s.cornerGlow} />
          <View style={s.bottomGlow} />
          <View style={s.topAccent} />

          <View style={s.header}>
            <View style={s.logoRow}>
              <View style={s.logoIconWrap}>
                <Feather name="activity" size={14} color={t.primary} />
              </View>
              <Text style={s.logoText}>ATHLETEAI</Text>
            </View>
            <View style={s.weekBadge}>
              <Text style={s.weekBadgeText}>{weekLabel}</Text>
            </View>
          </View>

          <View style={s.body}>
            <View style={s.trophyRing}>
              <Feather name="award" size={44} color={GOLD} />
              <View style={s.checkDot}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            </View>

            <Text style={s.goalLabel}>Weekly Goal Reached</Text>

            <View style={s.sessionsRow}>
              <Text style={s.sessionsNum}>{sessions}</Text>
              <Text style={s.sessionsOf}>/ {weeklyGoal}</Text>
            </View>
            <Text style={s.sessionsLabel}>
              {sessions === 1 ? "session" : "sessions"} this week
            </Text>

            <View style={s.badgesRow}>
              {sport ? (
                <View style={s.sportPill}>
                  <Feather name="activity" size={11} color={t.primary} />
                  <Text style={s.sportText}>{sport}</Text>
                </View>
              ) : null}
              {streakDays > 1 ? (
                <View style={s.streakPill}>
                  <Feather name="zap" size={11} color={STREAK_ORANGE} />
                  <Text style={s.streakText}>{streakDays}-day streak</Text>
                </View>
              ) : null}
            </View>
          </View>

          {topTip ? (
            <View style={s.tipRow}>
              <Feather name="message-circle" size={12} color={t.primary} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.tipLabel}>Coach's top tip</Text>
                <Text style={s.tipText}>{topTip.length > 80 ? topTip.slice(0, 77) + "…" : topTip}</Text>
              </View>
            </View>
          ) : null}

          <View style={s.divider} />
          <View style={s.footer}>
            <Text style={s.footerText}>
              Track your performance at{" "}
              <Text style={s.footerHighlight}>AthleteAI</Text>
            </Text>
          </View>
        </View>
      </ViewShot>
    );
  }
);

ShareCard.displayName = "ShareCard";
export default ShareCard;
