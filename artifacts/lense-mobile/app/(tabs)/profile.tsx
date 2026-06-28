import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth, useTier } from "@/lib/authContext";
import colors from "@/constants/colors";

const C = colors.light;

const SETTINGS_ROWS = [
  { icon: "bell" as const, label: "Notifications" },
  { icon: "shield" as const, label: "Privacy" },
  { icon: "help-circle" as const, label: "Help & Support" },
  { icon: "info" as const, label: "About AthleteAI" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const tier = useTier();

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

  const firstName = (profile?.name ?? user?.name ?? "Athlete");
  const initials = firstName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* Header */}
        <View style={[s.header, { paddingTop: topPad }]}>
          <Text style={s.pageTitle}>Profile</Text>
        </View>

        {/* Identity card */}
        <View style={s.identityCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.nameText}>{firstName}</Text>
            <Text style={s.emailText}>{user?.email ?? ""}</Text>
            <View style={s.tierBadge}>
              <Text style={s.tierText}>{tier === "pro" ? "⚡ Pro" : "Free"}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{profile?.streakDays ?? 0}</Text>
            <Text style={s.statLabel}>DAY STREAK</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{profile?.weeklyProgress ?? 0}</Text>
            <Text style={s.statLabel}>THIS WEEK</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{profile?.weeklyGoal ?? 3}</Text>
            <Text style={s.statLabel}>WEEKLY GOAL</Text>
          </View>
        </View>

        {/* Upgrade */}
        {tier === "free" && (
          <TouchableOpacity style={s.upgradeCard} onPress={() => router.push("/pricing")} activeOpacity={0.88}>
            <Feather name="zap" size={22} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={s.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={s.upgradeSub}>AI Coach · Unlimited analyses · Priority support</Text>
            </View>
            <Feather name="chevron-right" size={18} color={C.ink} />
          </TouchableOpacity>
        )}

        {/* Settings */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SETTINGS</Text>
          <View style={s.settingsCard}>
            {SETTINGS_ROWS.map((row, i) => (
              <TouchableOpacity key={row.label} style={[s.settingsRow, i < SETTINGS_ROWS.length - 1 && s.settingsRowBorder]} activeOpacity={0.7}>
                <View style={s.settingsIcon}>
                  <Feather name={row.icon} size={18} color={C.textSecondary} />
                </View>
                <Text style={s.settingsLabel}>{row.label}</Text>
                <Feather name="chevron-right" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign out */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.signOutBtn}
            onPress={() => {
              if (Platform.OS === "web") {
                logout();
              } else {
                Alert.alert("Sign Out", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign Out", style: "destructive", onPress: logout },
                ]);
              }
            }}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color={C.destructive} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  pageTitle: { fontFamily: "Archivo_800ExtraBold", fontSize: 28, color: C.textPrimary, letterSpacing: -0.5 },
  identityCard: { flexDirection: "row", alignItems: "center", gap: 16, marginHorizontal: 20, marginBottom: 16, backgroundColor: C.surface2, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(198,255,58,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.volt },
  avatarText: { fontFamily: "Archivo_800ExtraBold", fontSize: 22, color: C.volt },
  nameText: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.textPrimary },
  emailText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  tierBadge: { alignSelf: "flex-start", backgroundColor: "rgba(198,255,58,0.14)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  tierText: { fontFamily: "SpaceMono_700Bold", fontSize: 10, letterSpacing: 1, color: C.volt },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: C.surface2, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  statValue: { fontFamily: "Archivo_800ExtraBold", fontSize: 22, color: C.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1, color: C.textSecondary, marginTop: 4, textAlign: "center" },
  upgradeCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: C.volt, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  upgradeTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.ink },
  upgradeSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(7,9,11,0.7)", marginTop: 1 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 10, letterSpacing: 1.5, color: C.textTertiary, marginBottom: 10 },
  settingsCard: { backgroundColor: C.surface2, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  settingsIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  settingsLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, color: C.textPrimary },
  signOutBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface2, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  signOutText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.destructive },
});
