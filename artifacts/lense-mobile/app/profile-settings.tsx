import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/authContext";
import { useTheme } from "@/lib/themeContext";
import { ACCENT_PALETTES } from "@/constants/colors";
import type { AccentKey } from "@/constants/colors";
import { CropModal, type CropResult } from "@/components/CropModal";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SPACING, RADIUS } from "@/constants/spacing";
import { TYPE } from "@/constants/typography";
import { persistCheckInHour } from "@/utils/notifications";
import { buildSnapshot, computeIsDirty } from "@/utils/profileDirty";

const SPORTS = [
  "Powerlifting", "Olympic Weightlifting", "Running", "Swimming",
  "Basketball", "Soccer", "Tennis", "Golf", "CrossFit",
  "Gymnastics", "Boxing", "Cycling", "Football", "Baseball",
  "Volleyball", "Martial Arts", "Other",
];

const LEVELS = [
  { label: "Beginner", sub: "Just starting out" },
  { label: "Intermediate", sub: "1–3 years experience" },
  { label: "Advanced", sub: "3+ years, competing" },
  { label: "Elite", sub: "Professional / competitive athlete" },
];

const GOALS = [
  "Improve technique", "Prevent injuries", "Increase performance",
  "Learn new movements", "Recovery & rehab", "Competition prep",
];

const INJURIES = [
  "No current injuries", "Lower back", "Knee", "Shoulder",
  "Hip", "Ankle", "Elbow", "Neck",
];

const WEEKLY_GOAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

function getWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

/**
 * When the user raises or lowers their weekly goal mid-week we must clear the
 * "already celebrated" flag so the toast (and Home confetti) can re-evaluate
 * against the new target on the next completed analysis.
 */
async function resetGoalToastForWeek(): Promise<void> {
  const weekKey = getWeekKey();
  await AsyncStorage.removeItem(`confetti_celebrated_${weekKey}`);
}

// ─── Discard-prompt dirty-state contract ──────────────────────────────────────
// See utils/profileDirty.ts for the canonical field list and instructions on
// how to add new fields to the unsaved-changes detection.
// ─────────────────────────────────────────────────────────────────────────────

const CHECK_IN_HOURS = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22] as const;

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

/**
 * Maximum pixel dimension (width or height) for a raw image before the crop
 * step. Images larger than this are still accepted — CropModal will scale them
 * down to 400 × 400 — but we warn the user if the final encoded size is still
 * unreasonably large (see MAX_AVATAR_DATA_URI_CHARS below).
 */
const MAX_RAW_AVATAR_DIMENSION = 1024;

/**
 * Maximum character length for the full "data:<mime>;base64,…" string that
 * gets sent to the server. The server compresses further (to 64 × 64 / 20 KB),
 * but an enormous payload would still waste bandwidth and could time out.
 * 2 MB of base64 ≈ 1.5 MB of binary — well above what a 400 × 400 JPEG at
 * 0.7 quality should ever produce, so hitting this guard means something
 * unexpected happened with the image.
 */
const MAX_AVATAR_DATA_URI_CHARS = 2 * 1024 * 1024; // 2 MB of base64 characters

const PRESET_AVATARS = [
  { key: "preset:#6c63ff", color: "#6c63ff" },
  { key: "preset:#22c55e", color: "#22c55e" },
  { key: "preset:#f59e0b", color: "#f59e0b" },
  { key: "preset:#ff4d6d", color: "#ff4d6d" },
  { key: "preset:#06b6d4", color: "#06b6d4" },
  { key: "preset:#a855f7", color: "#a855f7" },
  { key: "preset:#ff6b35", color: "#ff6b35" },
  { key: "preset:#14b8a6", color: "#14b8a6" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "A";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function getPresetColor(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith("preset:")) return null;
  return avatarUrl.replace("preset:", "");
}

function isPhotoAvatar(avatarUrl: string | null | undefined): boolean {
  return !!avatarUrl && (avatarUrl.startsWith("data:") || avatarUrl.startsWith("file:") || avatarUrl.startsWith("http"));
}

interface AvatarDisplayProps {
  avatarUrl: string | null | undefined;
  name: string;
  size: number;
  colors: ReturnType<typeof useColors>;
  testID?: string;
}

export function AvatarDisplay({ avatarUrl, name, size, colors, testID }: AvatarDisplayProps) {
  const presetColor = getPresetColor(avatarUrl);
  const isPhoto = isPhotoAvatar(avatarUrl);
  const initials = getInitials(name || "Athlete");
  const fontSize = size * 0.38;

  if (isPhoto && avatarUrl) {
    return (
      <Image
        testID={testID}
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  const bg = presetColor ?? colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize, fontFamily: "Inter_700Bold", color: "#fff" }}>
        {initials}
      </Text>
    </View>
  );
}

export default function ProfileSettingsScreen() {
  const colors = useColors();
  const { isDark, toggleTheme, accentColor, setAccentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, profile, updateProfile, logout } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState(profile?.name ?? user?.name ?? "");
  const [sport, setSport] = useState(() => {
    if (!profile?.sport) return "";
    const raw = profile.sport;
    const match = SPORTS.find((s) => s.toLowerCase() === raw.toLowerCase());
    return match ?? raw;
  });
  const [level, setLevel] = useState(() => {
    if (!profile?.level) return "";
    const raw = profile.level;
    const match = LEVELS.find((l) => l.label.toLowerCase() === raw.toLowerCase());
    return match?.label ?? "";
  });
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [injuries, setInjuries] = useState<string[]>(profile?.injuryConcerns ?? []);
  const [weeklyGoal, setWeeklyGoal] = useState(profile?.weeklyGoal ?? 3);
  const [trainingDays, setTrainingDays] = useState<number[]>(profile?.trainingDays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [checkInHour, setCheckInHour] = useState(profile?.checkInHour ?? 9);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(profile?.avatarUrl);

  // Single serialised snapshot of all discard-prompt fields.
  // Adding a field to ProfileSnapshot + buildSnapshot() is all that is needed
  // to bring a new field under the discard-prompt guard.
  const savedSnapshot = useRef<string>(
    buildSnapshot({
      name: profile?.name ?? user?.name ?? "",
      sport: (() => {
        if (!profile?.sport) return "";
        const raw = profile.sport;
        const match = SPORTS.find((s) => s.toLowerCase() === raw.toLowerCase());
        return match ?? raw;
      })(),
      level: (() => {
        if (!profile?.level) return "";
        const raw = profile.level;
        const match = LEVELS.find((l) => l.label.toLowerCase() === raw.toLowerCase());
        return match?.label ?? "";
      })(),
      goals: profile?.goals ?? [],
      injuries: profile?.injuryConcerns ?? [],
    })
  );

  const isDirty = computeIsDirty(buildSnapshot({ name, sport, level, goals, injuries }), savedSnapshot.current);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e: any) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. If you leave now, they will be lost.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSavedFor, setGoalSavedFor] = useState<number | null>(null);
  const [goalAutoSuggestedFor, setGoalAutoSuggestedFor] = useState<number | null>(null);
  const goalAutoSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True when the stored weeklyGoal doesn't match the number of training days on
  // first load. The nudge is dismissed once the user fixes or ignores it.
  const [showMismatchNudge, setShowMismatchNudge] = useState(() => {
    const days = profile?.trainingDays ?? [0, 1, 2, 3, 4, 5, 6];
    const goal = profile?.weeklyGoal ?? 3;
    return days.length !== goal;
  });
  const [daysSaving, setDaysSaving] = useState(false);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInSavedFor, setCheckInSavedFor] = useState<number | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageWidth, setPendingImageWidth] = useState(0);
  const [pendingImageHeight, setPendingImageHeight] = useState(0);

  async function handleMismatchFix() {
    const correctedGoal = trainingDays.length as typeof WEEKLY_GOAL_OPTIONS[number];
    setShowMismatchNudge(false);
    await handleWeeklyGoalTap(correctedGoal);
  }

  async function handleTrainingDayToggle(dayIdx: number) {
    if (daysSaving) return;
    const next = trainingDays.includes(dayIdx)
      ? trainingDays.filter((d) => d !== dayIdx)
      : [...trainingDays, dayIdx].sort((a, b) => a - b);
    if (next.length === 0) return;
    const prevDays = trainingDays;
    const prevGoal = weeklyGoal;
    const suggestedGoal = next.length as typeof WEEKLY_GOAL_OPTIONS[number];
    const shouldSuggestGoal = suggestedGoal !== weeklyGoal;
    setTrainingDays(next);
    setShowMismatchNudge(false);
    if (shouldSuggestGoal) {
      setWeeklyGoal(suggestedGoal);
    }
    setDaysSaving(true);
    try {
      await updateProfile(
        shouldSuggestGoal
          ? { trainingDays: next, weeklyGoal: suggestedGoal }
          : { trainingDays: next }
      );
      if (shouldSuggestGoal) {
        if (goalAutoSuggestTimerRef.current) {
          clearTimeout(goalAutoSuggestTimerRef.current);
        }
        // Goal changed — clear the "already celebrated" flag so the toast can
        // re-evaluate against the new target. Fire-and-forget — non-critical.
        resetGoalToastForWeek().catch(() => {});
        setGoalAutoSuggestedFor(suggestedGoal);
        goalAutoSuggestTimerRef.current = setTimeout(() => {
          setGoalAutoSuggestedFor(null);
          goalAutoSuggestTimerRef.current = null;
        }, 4000);
      }
    } catch {
      setTrainingDays(prevDays);
      if (shouldSuggestGoal) setWeeklyGoal(prevGoal);
      setError("Couldn't update training schedule. Please try again.");
    } finally {
      setDaysSaving(false);
    }
  }

  async function handleWeeklyGoalTap(n: number) {
    if (goalSaving || n === weeklyGoal) return;
    const prev = weeklyGoal;
    setWeeklyGoal(n);
    setShowMismatchNudge(false);
    if (goalAutoSuggestTimerRef.current) {
      clearTimeout(goalAutoSuggestTimerRef.current);
      goalAutoSuggestTimerRef.current = null;
    }
    setGoalAutoSuggestedFor(null);
    setGoalSaving(true);
    try {
      await updateProfile({ weeklyGoal: n });
      // Clear the "already celebrated" flag so the toast re-evaluates against
      // the new target. Fire-and-forget — non-critical.
      resetGoalToastForWeek().catch(() => {});
      setGoalSavedFor(n);
      setTimeout(() => setGoalSavedFor(null), 1500);
    } catch {
      setWeeklyGoal(prev);
      setError("Couldn't update weekly goal. Please try again.");
    } finally {
      setGoalSaving(false);
    }
  }

  async function handleCheckInHourTap(h: number) {
    if (checkInSaving || h === checkInHour) return;
    const prev = checkInHour;
    setCheckInHour(h);
    setCheckInSaving(true);
    try {
      await updateProfile({ checkInHour: h });
      persistCheckInHour(h).catch(() => {});
      setCheckInSavedFor(h);
      setTimeout(() => setCheckInSavedFor(null), 1500);
    } catch {
      setCheckInHour(prev);
      setError("Couldn't update notification time. Please try again.");
    } finally {
      setCheckInSaving(false);
    }
  }

  function toggleGoal(val: string) {
    setGoals((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  function toggleInjury(val: string) {
    setInjuries((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  async function handleRemovePhoto() {
    setAvatarUrl(null);
    setAvatarSaving(true);
    try {
      await updateProfile({ avatarUrl: null });
    } catch {
      setAvatarUrl(profile?.avatarUrl);
      setError("Couldn't remove photo. Please try again.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSelectPreset(key: string) {
    setAvatarUrl(key);
    setAvatarSaving(true);
    try {
      await updateProfile({ avatarUrl: key });
    } catch {
      setError("Couldn't update avatar. Please try again.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to pick a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0]!;
    const width = asset.width ?? 800;
    const height = asset.height ?? 800;

    if (width > MAX_RAW_AVATAR_DIMENSION || height > MAX_RAW_AVATAR_DIMENSION) {
      Alert.alert(
        "Large image detected",
        `This photo is ${width} × ${height} px. It will be scaled down to fit your profile — the crop editor may take a moment to load.`,
        [{ text: "OK" }]
      );
    }

    setPendingImageUri(asset.uri);
    setPendingImageWidth(width);
    setPendingImageHeight(height);
    setCropVisible(true);
  }

  async function handleCropConfirm(cropResult: CropResult) {
    setCropVisible(false);
    const uri = `data:${cropResult.mimeType};base64,${cropResult.base64}`;

    if (uri.length > MAX_AVATAR_DATA_URI_CHARS) {
      setError(
        "This image is still too large after processing. Please choose a smaller photo and try again."
      );
      return;
    }

    setAvatarUrl(uri);
    setAvatarSaving(true);
    try {
      await updateProfile({ avatarUrl: uri });
    } catch {
      setError("Couldn't save photo. Please try again.");
      setAvatarUrl(profile?.avatarUrl);
    } finally {
      setAvatarSaving(false);
    }
  }

  function handleCropCancel() {
    setCropVisible(false);
    setPendingImageUri(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        sport: sport ? sport.toLowerCase() : undefined,
        level: level ? (level.toLowerCase() as any) : undefined,
        goals,
        injuryConcerns: injuries,
        weeklyGoal,
      });
      savedSnapshot.current = buildSnapshot({ name, sport, level, goals, injuries });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    router.back();
  }

  function handleLogout() {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  }

  const displayName = name || user?.name || "Athlete";

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + SPACING.sm + SPACING.xs,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      ...TYPE.bodySemi,
      color: colors.foreground,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: bottomPad + 120,
    },

    avatarSection: {
      alignItems: "center",
      marginBottom: SPACING.xl,
    },
    avatarRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      marginBottom: SPACING.md,
    },
    avatarEditBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm + 2,
      justifyContent: "center",
      marginBottom: SPACING.sm + 4,
    },
    presetDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    presetDotSelected: {
      borderWidth: 2.5,
      borderColor: "#fff",
    },

    section: { marginBottom: SPACING.lg },

    input: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md - 2,
      paddingVertical: 13,
      ...TYPE.body,
      color: colors.foreground,
    },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    chip: {
      paddingHorizontal: SPACING.md - 2,
      paddingVertical: SPACING.sm + 1,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
    },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

    levelCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: SPACING.md - 2,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      marginBottom: SPACING.sm + 1,
    },
    levelLabel: { ...TYPE.bodySemi },
    levelSub: { ...TYPE.caption, marginTop: 2 },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    weeklyRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm + 2 },
    weeklyBtn: {
      width: 66,
      height: 66,
      borderRadius: RADIUS.md,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    weeklyNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
    weeklyLabel: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 1 },

    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md - 2,
      paddingBottom: bottomPad + SPACING.lg - 4,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: SPACING.sm + 2,
    },

    errorBanner: {
      backgroundColor: colors.destructive + "14",
      borderRadius: RADIUS.sm + 2,
      borderWidth: 1,
      borderColor: colors.destructive + "33",
      padding: SPACING.sm + 4,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    savedBanner: {
      backgroundColor: colors.success + "14",
      borderRadius: RADIUS.sm + 2,
      borderWidth: 1,
      borderColor: colors.success + "33",
      padding: SPACING.sm + 4,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
  });

  return (
    <View style={s.container}>
      {pendingImageUri && (
        <CropModal
          visible={cropVisible}
          imageUri={pendingImageUri}
          imageWidth={pendingImageWidth}
          imageHeight={pendingImageHeight}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Status banners ── */}
        {error && (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              {error}
            </Text>
          </View>
        )}
        {saved && (
          <View style={s.savedBanner}>
            <Feather name="check-circle" size={15} color={colors.success} />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 18 }}>
              Changes saved!
            </Text>
          </View>
        )}

        {/* ── Avatar Picker ── */}
        <View style={s.avatarSection}>
          <TouchableOpacity
            testID="avatar-photo-btn"
            style={s.avatarRing}
            onPress={handlePickPhoto}
            activeOpacity={0.85}
            disabled={avatarSaving}
          >
            <AvatarDisplay
              testID="avatar-image"
              avatarUrl={avatarUrl}
              name={displayName}
              size={88}
              colors={colors}
            />
            <View style={s.avatarEditBadge}>
              <Feather name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Preset color swatches */}
          <View style={s.presetRow}>
            {PRESET_AVATARS.map((p) => {
              const selected = avatarUrl === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  testID={`preset-swatch-${p.key}`}
                  accessibilityState={{ selected }}
                  style={[
                    s.presetDot,
                    { backgroundColor: p.color },
                    selected && s.presetDotSelected,
                  ]}
                  onPress={() => handleSelectPreset(p.key)}
                  activeOpacity={0.8}
                  disabled={avatarSaving}
                >
                  {selected && (
                    <Feather name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label="Choose from library"
            onPress={handlePickPhoto}
            loading={avatarSaving}
            icon="image"
            variant="outline"
            size="sm"
          />

          {isPhotoAvatar(avatarUrl) && (
            <Button
              label="Remove photo"
              onPress={handleRemovePhoto}
              loading={avatarSaving}
              icon="trash-2"
              variant="ghost"
              size="sm"
            />
          )}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Name ── */}
        <View style={s.section}>
          <SectionHeader title="Your Name" />
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alex Johnson"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Sport ── */}
        <View style={s.section}>
          <SectionHeader title="Sport" />
          <View style={s.chipRow}>
            {SPORTS.map((sp) => {
              const active = sport === sp;
              return (
                <TouchableOpacity
                  key={sp}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? colors.primary + "20" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSport(sp)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {sp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Level ── */}
        <View style={s.section}>
          <SectionHeader title="Experience Level" />
          {LEVELS.map((lv) => {
            const active = level === lv.label;
            return (
              <TouchableOpacity
                key={lv.label}
                style={[
                  s.levelCard,
                  {
                    backgroundColor: active ? colors.primary + "12" : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setLevel(lv.label)}
                activeOpacity={0.75}
              >
                <View>
                  <Text style={[s.levelLabel, { color: colors.foreground }]}>{lv.label}</Text>
                  <Text style={[s.levelSub, { color: colors.mutedForeground }]}>{lv.sub}</Text>
                </View>
                {active && (
                  <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Goals ── */}
        <View style={s.section}>
          <SectionHeader title="Training Goals" />
          <View style={s.chipRow}>
            {GOALS.map((goal) => {
              const active = goals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? colors.primary + "20" : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleGoal(goal)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {goal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Injury Concerns ── */}
        <View style={s.section}>
          <SectionHeader title="Injury Concerns" />
          {INJURIES.map((inj) => {
            const active = injuries.includes(inj);
            return (
              <TouchableOpacity
                key={inj}
                style={[
                  s.levelCard,
                  {
                    backgroundColor: active ? colors.primary + "12" : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleInjury(inj)}
                activeOpacity={0.75}
              >
                <Text style={[s.levelLabel, { color: colors.foreground }]}>{inj}</Text>
                {active && (
                  <View style={[s.checkCircle, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Weekly Goal ── */}
        <View style={s.section}>
          <SectionHeader title="Weekly Training Goal" />
          <View style={s.weeklyRow}>
            {WEEKLY_GOAL_OPTIONS.map((n) => {
              const active = weeklyGoal === n;
              const justSaved = goalSavedFor === n;
              return (
                <TouchableOpacity
                  key={n}
                  testID={`weekly-goal-btn-${n}`}
                  accessibilityState={{ selected: active }}
                  style={[
                    s.weeklyBtn,
                    {
                      borderColor: justSaved ? colors.success : active ? colors.primary : colors.border,
                      backgroundColor: justSaved
                        ? colors.success + "18"
                        : active
                        ? colors.primary + "18"
                        : colors.card,
                    },
                  ]}
                  onPress={() => handleWeeklyGoalTap(n)}
                  disabled={goalSaving}
                  activeOpacity={0.75}
                >
                  <Text style={[s.weeklyNum, { color: justSaved ? colors.success : active ? colors.primary : colors.foreground }]}>
                      {n}
                    </Text>
                  <Text style={[s.weeklyLabel, { color: justSaved ? colors.success : active ? colors.primary : colors.mutedForeground }]}>
                    {n === 1 ? "session" : "sessions"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {goalSaving && (
            <Button
              label="Saving…"
              onPress={() => {}}
              loading={goalSaving}
              variant="ghost"
              size="sm"
              disabled
            />
          )}
          {goalAutoSuggestedFor !== null && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              marginTop: 12,
              backgroundColor: colors.primary + "14",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.primary + "33",
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}>
              <Feather name="info" size={13} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 17 }}>
                We set your weekly goal to{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>{goalAutoSuggestedFor}</Text>
                {" "}to match your training days. Tap any number above to override.
              </Text>
            </View>
          )}
          {showMismatchNudge && goalAutoSuggestedFor === null && (
            <View
              testID="mismatch-nudge"
              style={{
                marginTop: 12,
                backgroundColor: colors.warning + "14",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.warning + "44",
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
                <Feather name="alert-triangle" size={13} color={colors.warning} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 17 }}>
                  Your weekly goal (
                  <Text style={{ fontFamily: "Inter_600SemiBold" }}>{weeklyGoal}</Text>
                  ) doesn't match your training days (
                  <Text style={{ fontFamily: "Inter_600SemiBold" }}>{trainingDays.length}</Text>
                  ). Want to fix it?
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  testID="mismatch-fix-btn"
                  onPress={handleMismatchFix}
                  disabled={goalSaving}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: colors.warning + "22",
                    borderWidth: 1,
                    borderColor: colors.warning + "66",
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.warning }}>
                    Update to {trainingDays.length}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="mismatch-dismiss-btn"
                  onPress={() => setShowMismatchNudge(false)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                    Dismiss
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Check-in Time ── */}
        <View style={s.section}>
          <SectionHeader title="Improvement Notification Time" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 12, lineHeight: 17 }}>
            When you beat a previous scan, we'll remind you at this time the next day.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CHECK_IN_HOURS.map((h) => {
              const active = checkInHour === h;
              const justSaved = checkInSavedFor === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[
                    s.chip,
                    {
                      borderColor: justSaved ? colors.success : active ? colors.primary : colors.border,
                      backgroundColor: justSaved
                        ? colors.success + "18"
                        : active
                        ? colors.primary + "18"
                        : colors.card,
                    },
                  ]}
                  onPress={() => handleCheckInHourTap(h)}
                  disabled={checkInSaving}
                  activeOpacity={0.75}
                >
                  <Text style={[
                      s.chipText,
                      { color: justSaved ? colors.success : active ? colors.primary : colors.mutedForeground },
                    ]}>
                      {formatHour(h)}
                    </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {checkInSaving && (
            <Button
              label="Saving…"
              onPress={() => {}}
              loading={checkInSaving}
              variant="ghost"
              size="sm"
              disabled
            />
          )}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Training Days ── */}
        <View style={s.section}>
          <SectionHeader title="Training Days" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 12, lineHeight: 17 }}>
            Tap the days you plan to train. Rest days won't count against your weekly goal.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {(["S", "M", "T", "W", "T", "F", "S"] as const).map((label, dayIdx) => {
              const active = trainingDays.includes(dayIdx);
              return (
                <TouchableOpacity
                  key={dayIdx}
                  onPress={() => handleTrainingDayToggle(dayIdx)}
                  disabled={daysSaving}
                  activeOpacity={0.75}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? colors.primary + "18" : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: daysSaving ? 0.6 : 1,
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: active ? colors.primary : colors.mutedForeground,
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {daysSaving && (
            <Button
              label="Saving schedule…"
              onPress={() => {}}
              loading={daysSaving}
              variant="ghost"
              size="sm"
              disabled
            />
          )}
        </View>

        <Divider margin={SPACING.sm} />

        {/* ── Display ── */}
        <View style={s.section}>
          <SectionHeader title="Display" />

          {/* Dark / light toggle */}
          <TouchableOpacity
            onPress={toggleTheme}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center" }}>
                <Feather name={isDark ? "moon" : "sun"} size={17} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                  {isDark ? "Dark Mode" : "Light Mode"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                  Tap to switch to {isDark ? "light" : "dark"} mode
                </Text>
              </View>
            </View>
            <View style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              backgroundColor: isDark ? colors.primary : colors.muted,
              justifyContent: "center",
              paddingHorizontal: 3,
            }}>
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: isDark ? "#fff" : colors.mutedForeground,
                alignSelf: isDark ? "flex-end" : "flex-start",
              }} />
            </View>
          </TouchableOpacity>

          {/* Accent colour palettes */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 12 }}>
              Accent Colour
            </Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {(Object.keys(ACCENT_PALETTES) as AccentKey[]).map((key) => {
                const palette = ACCENT_PALETTES[key];
                const isSelected = accentColor === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setAccentColor(key)}
                    activeOpacity={0.75}
                    accessibilityLabel={palette.label}
                    style={{ alignItems: "center", gap: 6 }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: palette.color,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: isSelected ? 3 : 2,
                        borderColor: isSelected ? palette.color : colors.border,
                        shadowColor: isSelected ? palette.color : "transparent",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: isSelected ? 0.55 : 0,
                        shadowRadius: isSelected ? 8 : 0,
                        elevation: isSelected ? 6 : 0,
                      }}
                    >
                      {isSelected && (
                        <Feather name="check" size={16} color="#fff" />
                      )}
                    </View>
                    <Text style={{
                      fontSize: 11,
                      fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                      color: isSelected ? palette.color : colors.mutedForeground,
                    }}>
                      {palette.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Live accent preview */}
            <View
              testID="accent-preview"
              style={{
                marginTop: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Preview
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {/* Mini primary button */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Feather name="check" size={12} color="#fff" />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
                    Save
                  </Text>
                </View>

                {/* Mini score ring */}
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      borderWidth: 3,
                      borderColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primary + "14",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.primary }}>
                      82
                    </Text>
                  </View>
                </View>

                {/* Mini chip / tag */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "18",
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
                    Hip
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={s.bottomBar}>
        <Button
          label={saving ? "Saving…" : "Save Changes"}
          onPress={handleSave}
          loading={saving}
          icon="check"
          size="lg"
          fullWidth
        />
        <Button
          label="Log Out"
          onPress={handleLogout}
          variant="destructive"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
}
