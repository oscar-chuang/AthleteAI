import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAuth, useTier } from "@/lib/authContext";
import { AvatarDisplay } from "@/app/profile-settings";
import { SPACING } from "@/constants/spacing";
import { TYPE } from "@/constants/typography";
import { toTitleCase } from "@/utils/formatDisplay";

function ProfileRow({
  icon,
  label,
  value,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const inner = (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.surface3 }]}>
        <Feather name={icon} size={16} color={colors.mutedForeground} />
      </View>
      <View style={rowStyles.labelWrap}>
        <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        {value ? (
          <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
        ) : null}
      </View>
      {onPress && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  labelWrap: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...TYPE.caption,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    ...TYPE.body,
    fontSize: 15,
  },
});

export default function ProfileTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const tier = useTier();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const s = StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.background },
    header:       { paddingTop: topPad + SPACING.lg, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
    title:        { ...TYPE.title, color: colors.foreground },
    heroCard:     {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.xl,
      padding: SPACING.lg,
      borderRadius: 20,
      backgroundColor: colors.surface2,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
    },
    nameBlock:    { flex: 1, gap: 4 },
    name:         { ...TYPE.title, fontSize: 20, color: colors.foreground },
    sport:        { ...TYPE.caption, color: colors.mutedForeground, textTransform: "capitalize" as const },
    tierBadge:    {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: colors.primary + "22",
      alignSelf: "flex-start",
    },
    tierText:     { fontSize: 11, fontFamily: "Inter_700Bold", color: colors.primary, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    editBtn:      {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface3,
      alignItems: "center",
      justifyContent: "center",
    },
    section:      { marginBottom: SPACING.xl },
    sectionLabel: {
      ...TYPE.captionMed,
      color: colors.mutedForeground,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    sectionCard:  {
      backgroundColor: colors.surface2,
      marginHorizontal: SPACING.lg,
      borderRadius: 16,
      overflow: "hidden" as const,
    },
    logoutBtn:    {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center" as const,
      backgroundColor: colors.surface2,
    },
    logoutText:   { ...TYPE.bodySemi, color: colors.destructive, fontSize: 15 },
  });

  const sportLabel = profile?.sport && profile?.level
    ? `${toTitleCase(profile.sport)} · ${toTitleCase(profile.level)}`
    : profile?.sport
    ? toTitleCase(profile.sport)
    : "No sport set";

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
        </View>

        {/* Hero card */}
        <View style={s.heroCard}>
          <AvatarDisplay
            avatarUrl={profile?.avatarUrl}
            name={profile?.name ?? "Athlete"}
            size={56}
            colors={colors}
          />
          <View style={s.nameBlock}>
            <Text style={s.name}>{profile?.name ?? "Athlete"}</Text>
            <Text style={s.sport}>{sportLabel}</Text>
            {tier !== "free" && (
              <View style={s.tierBadge}>
                <Text style={s.tierText}>{tier}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push("/profile-settings")}
            activeOpacity={0.75}
          >
            <Feather name="edit-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Account</Text>
          <View style={s.sectionCard}>
            <ProfileRow
              icon="user"
              label="Profile & Settings"
              value="Edit sport, level, goals"
              onPress={() => router.push("/profile-settings")}
              colors={colors}
            />
            {tier === "free" && (
              <ProfileRow
                icon="zap"
                label="Upgrade to Pro"
                value="Unlock AI coach & unlimited analyses"
                onPress={() => router.push("/pricing")}
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* Activity section */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Activity</Text>
          <View style={s.sectionCard}>
            <ProfileRow
              icon="activity"
              label="My Analyses"
              onPress={() => router.push("/(tabs)/analyze")}
              colors={colors}
            />
            <ProfileRow
              icon="trending-up"
              label="Progress & Stats"
              onPress={() => router.push("/(tabs)/progress")}
              colors={colors}
            />
            <ProfileRow
              icon="message-circle"
              label="AI Coach"
              onPress={() => router.push("/(tabs)/chat")}
              colors={colors}
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={s.logoutBtn}
          activeOpacity={0.8}
          onPress={() => logout()}
        >
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
