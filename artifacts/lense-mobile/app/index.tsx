import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";

const SPORTS = [
  "Running", "Basketball", "Soccer", "Football",
  "Tennis", "Baseball", "Volleyball", "Swimming",
  "Weightlifting", "Powerlifting", "CrossFit", "Gymnastics", "Cycling",
];

const FEATURES = [
  { icon: "activity" as const,    color: "#06b6d4", label: "AI Motion Analysis" },
  { icon: "shield" as const,      color: "#f97316", label: "Injury Prevention" },
  { icon: "trending-up" as const, color: "#22d3ee", label: "Progress Tracking" },
  { icon: "zap" as const,         color: "#FF6B35", label: "Performance Coaching" },
];

const HIGHLIGHTS = [
  { icon: "layers" as const,  color: "#2F7BFF", label: "13 Sports", sub: "Supported" },
  { icon: "book-open" as const, color: "#22C55E", label: "Peer-reviewed", sub: "Research-backed tips" },
];

export default function LandingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isAuthenticated]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const s = StyleSheet.create({
    container:       { flex: 1, backgroundColor: colors.background },
    inner:           { flexGrow: 1, paddingHorizontal: 24, paddingTop: topPad + 36, paddingBottom: bottomPad + 24 },
    topSection:      { alignItems: "center", paddingBottom: 40 },
    logoRow:         { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 36 },
    logoIcon:        { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary + "22", borderWidth: 1.5, borderColor: colors.primary + "44", alignItems: "center", justifyContent: "center" },
    logoText:        { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground },
    headline:        { fontSize: 38, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", lineHeight: 44, marginBottom: 14 },
    accent:          { color: colors.primary },
    subhead:         { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 300 },
    sportsLabel:     { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, marginTop: 28, marginBottom: 10, alignSelf: "flex-start" },
    sportsRow:       { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    sportPill:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    sportPillText:   { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    featuresGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 28, width: "100%" },
    featureItem:     { flexDirection: "row", alignItems: "center", gap: 8, width: "47%", backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
    featureText:     { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    highlightsRow:   { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 28, width: "100%" },
    highlightCard:   { flex: 1, alignItems: "center", backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.border, gap: 6 },
    highlightLabel:  { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    highlightSub:    { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 13 },
    bottomSection:   { gap: 12 },
    primaryBtn:      { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    primaryBtnText:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    secondaryBtn:    { borderRadius: 16, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
    secondaryBtnText:{ color: colors.mutedForeground, fontSize: 15, fontFamily: "Inter_500Medium" },
    freeNote:        { textAlign: "center", fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.inner} showsVerticalScrollIndicator={false} bounces={false}>
      <Animated.View style={{ flex: 1, justifyContent: "space-between", opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        <View style={s.topSection}>
          <View style={s.logoRow}>
            <View style={s.logoIcon}>
              <Feather name="zap" size={22} color={colors.primary} />
            </View>
            <Text style={s.logoText}>AthleteAI</Text>
          </View>

          <Text style={s.headline}>
            Elite coaching.{"\n"}
            <Text style={s.accent}>Powered by AI.</Text>
          </Text>
          <Text style={s.subhead}>
            Upload any training video. Get biomechanics analysis, personalised coaching tips, and injury prevention — backed by peer-reviewed sports science.
          </Text>

          {/* Sports — all 13 */}
          <Text style={s.sportsLabel}>WORKS FOR EVERY SPORT</Text>
          <View style={s.sportsRow}>
            {SPORTS.map((sport) => (
              <View key={sport} style={s.sportPill}>
                <Text style={s.sportPillText}>{sport}</Text>
              </View>
            ))}
          </View>

          {/* Feature tiles */}
          <View style={s.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.label} style={s.featureItem}>
                <Feather name={f.icon} size={16} color={f.color} />
                <Text style={s.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Honest highlights */}
          <View style={s.highlightsRow}>
            {HIGHLIGHTS.map((h) => (
              <View key={h.label} style={s.highlightCard}>
                <Feather name={h.icon} size={18} color={h.color} />
                <Text style={s.highlightLabel}>{h.label}</Text>
                <Text style={s.highlightSub}>{h.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA — separated from content by flex space-between */}
        <View style={s.bottomSection}>
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={() => router.push("/auth/signup")}>
            <Feather name="zap" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Get Started Free</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.75} onPress={() => router.push("/auth/login")}>
            <Text style={s.secondaryBtnText}>Sign in</Text>
          </TouchableOpacity>

          <Text style={s.freeNote}>Free to start · No credit card required</Text>
        </View>

      </Animated.View>
    </ScrollView>
  );
}
