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

const SPORTS = ["Fencing", "Weightlifting", "Basketball", "Golf", "Tennis", "Running"];

const FEATURES = [
  { icon: "activity" as const, color: "#06b6d4", label: "AI Motion Analysis" },
  { icon: "shield" as const, color: "#f97316", label: "Injury Prevention" },
  { icon: "trending-up" as const, color: "#22d3ee", label: "Progress Tracking" },
  { icon: "users" as const, color: "#10b981", label: "Pro Comparisons" },
];

export default function LandingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Skip landing page for returning users
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
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: topPad + 40,
      paddingBottom: bottomPad + 24,
      justifyContent: "space-between",
    },
    topSection: { alignItems: "center" },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 40,
    },
    logoIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary + "22",
      borderWidth: 1.5,
      borderColor: colors.primary + "44",
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: {
      fontSize: 24,
      fontFamily: "Archivo_800ExtraBold",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headline: {
      fontSize: 38,
      fontFamily: "Archivo_900Black",
      color: colors.foreground,
      textAlign: "center",
      lineHeight: 44,
      letterSpacing: -1,
      marginBottom: 14,
    },
    accent: { color: colors.primary },
    subhead: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    sportsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 28,
    },
    sportPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sportPillText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    featuresGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 32,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    featureText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      flex: 1,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 32,
      marginTop: 28,
    },
    stat: { alignItems: "center" },
    statValue: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    statLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    bottomSection: { gap: 12 },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    secondaryBtn: {
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.mutedForeground,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    freeNote: {
      textAlign: "center",
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
      <Animated.View
        style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
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
            Upload any training video. Get biomechanics analysis, personalized coaching, and injury prevention in seconds.
          </Text>

          <View style={s.sportsRow}>
            {SPORTS.map((sport) => (
              <View key={sport} style={s.sportPill}>
                <Text style={s.sportPillText}>{sport}</Text>
              </View>
            ))}
          </View>

          <View style={s.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.label} style={s.featureItem}>
                <Feather name={f.icon} size={16} color={f.color} />
                <Text style={s.featureText}>{f.label}</Text>
              </View>
            ))}
          </View>

        </View>

        <View style={s.bottomSection}>
          <TouchableOpacity
            style={s.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push("/onboarding")}
          >
            <Feather name="zap" size={18} color={colors.primaryForeground} />
            <Text style={s.primaryBtnText}>Get Started Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            activeOpacity={0.75}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={s.secondaryBtnText}>Sign in</Text>
          </TouchableOpacity>

          <Text style={s.freeNote}>Free to start · No credit card required</Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}
