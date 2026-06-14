import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi, type AnalysisRecord, ApiError } from "@/lib/api";
import { useAuth, useCanAccessFeature } from "@/lib/authContext";

const SPORTS = [
  "Weightlifting", "Running", "Basketball", "Golf", "Tennis",
  "Swimming", "CrossFit", "Boxing", "Soccer", "Gymnastics",
  "Cycling", "Fencing", "Rowing", "Volleyball", "Baseball",
  "Wrestling", "Rugby", "Hockey", "Yoga", "Other",
];

const SPORT_ACCENT: Record<string, string> = {
  weightlifting: "#ef4444",
  running:       "#22c55e",
  basketball:    "#f97316",
  golf:          "#10b981",
  tennis:        "#6366f1",
  swimming:      "#38bdf8",
  crossfit:      "#f59e0b",
  boxing:        "#dc2626",
  soccer:        "#16a34a",
  gymnastics:    "#a855f7",
  cycling:       "#0ea5e9",
  fencing:       "#a78bfa",
  rowing:        "#14b8a6",
  volleyball:    "#fbbf24",
  baseball:      "#60a5fa",
  wrestling:     "#fb923c",
  rugby:         "#34d399",
  hockey:        "#818cf8",
  yoga:          "#ec4899",
  other:         "#6c63ff",
};

const ANALYSIS_STEPS = [
  { label: "Extracting video frames",  icon: "film"     },
  { label: "Detecting body pose",      icon: "user"     },
  { label: "Calculating joint angles", icon: "activity" },
  { label: "Running AI analysis",      icon: "cpu"      },
  { label: "Generating report",        icon: "file-text"},
];

type SortMode = "newest" | "oldest" | "score-high" | "score-low";

function getSportAccent(sport: string, fallback: string) {
  return SPORT_ACCENT[sport.toLowerCase()] ?? fallback;
}

function getScoreColor(score: number, colors: ReturnType<typeof useColors>) {
  if (score >= 80) return colors.success;
  if (score >= 65) return colors.primary;
  return colors.warning;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const canUnlimited = useCanAccessFeature("unlimitedAnalyses");

  const [analysisList, setAnalysisList] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  // Sport picker modal
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [selectedSport, setSelectedSport] = useState("");

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 60;

  const loadAnalyses = useCallback(async () => {
    try {
      const { analyses } = await analysesApi.list();
      setAnalysisList(analyses);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time this tab is focused
  useFocusEffect(useCallback(() => { loadAnalyses(); }, [loadAnalyses]));

  // Poll if any analysis is still processing
  useEffect(() => {
    const hasProcessing = analysisList.some(
      (a) => a.status === "processing" || a.status === "pending"
    );
    if (!hasProcessing) return;
    const id = setInterval(loadAnalyses, 5000);
    return () => clearInterval(id);
  }, [analysisList, loadAnalyses]);

  // Stats computed from list
  const headerStats = useMemo(() => {
    const done = analysisList.filter((a) => a.status === "complete");
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = done.filter((a) => new Date(a.uploadedAt) >= weekStart).length;
    const avg = done.length
      ? Math.round(done.reduce((s, a) => s + (a.overallScore ?? 0), 0) / done.length)
      : 0;
    return { total: done.length, thisWeek, avg };
  }, [analysisList]);

  // Filter + sort
  const displayList = useMemo(() => {
    let list = analysisList;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.sport.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "score-high": return (b.overallScore ?? 0) - (a.overallScore ?? 0);
        case "score-low":  return (a.overallScore ?? 0) - (b.overallScore ?? 0);
        case "oldest":     return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        default:           return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
    });
  }, [analysisList, searchQuery, sortBy]);

  async function handleUpload() {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow photo & video access in Settings to pick a clip.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri ?? "";
      if (!uri) return;
      setPendingUri(uri);
      setPendingTitle("");
      setSelectedSport(profile?.sport ?? "");
      setShowSportPicker(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isiCloud = /3164|PHPhotos|could not be completed/i.test(msg);
      Alert.alert(
        "Couldn't load that video",
        isiCloud
          ? "This clip is in iCloud and hasn't downloaded yet. Open Photos, let it download, then try again."
          : "Something went wrong. Please try a different clip.",
      );
    }
  }

  async function handleRecord() {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Video recording is only available on the mobile app.");
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow camera access in Settings to record a clip.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "videos",
        allowsEditing: false,
        videoMaxDuration: 90,
        quality: 0.85,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri ?? "";
      if (!uri) return;
      setPendingUri(uri);
      setPendingTitle("");
      setSelectedSport(profile?.sport ?? "");
      setShowSportPicker(true);
    } catch {
      Alert.alert("Couldn't record video", "Something went wrong. Please try again.");
    }
  }

  async function submitAnalysis() {
    if (!selectedSport || !pendingUri) return;
    setShowSportPicker(false);
    setAnalyzing(true);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 1100);

    try {
      const { analysis } = await analysesApi.create({
        title: pendingTitle.trim() || `${selectedSport} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        sport: selectedSport.toLowerCase(),
        videoUrl: pendingUri,
      });
      await AsyncStorage.setItem(`video_uri_${analysis.id}`, pendingUri);
      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 500));
      setAnalyzing(false);
      await loadAnalyses();
      router.push(`/analysis/${analysis.id}`);
    } catch (err) {
      clearInterval(stepInterval);
      setAnalyzing(false);
      if (err instanceof ApiError && err.code === "UPGRADE_REQUIRED") {
        Alert.alert(
          "Upgrade Required",
          err.message,
          [
            { text: "Not now", style: "cancel" },
            { text: "View Plans", onPress: () => router.push("/pricing") },
          ]
        );
      } else {
        Alert.alert("Analysis failed", "Please try again.");
      }
    }
  }

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "newest",     label: "Newest"    },
    { key: "oldest",     label: "Oldest"    },
    { key: "score-high", label: "Best ↑"    },
    { key: "score-low",  label: "Worst ↓"   },
  ];

  const s = StyleSheet.create({
    container:       { flex: 1, backgroundColor: colors.background },
    header:          { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 4 },
    titleRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title:           { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    statsRow:        { flexDirection: "row", gap: 10, marginBottom: 16 },
    statPill:        { flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: "center" },
    statVal:         { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLbl:         { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 1 },
    searchRow:       { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 12 },
    searchInput:     { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular" },
    sortRow:         { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 14 },
    sortChip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    sortChipActive:  { backgroundColor: colors.primary + "22", borderColor: colors.primary },
    sortChipText:    { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sortChipTextActive: { color: colors.primary },
    actionRow:       { flexDirection: "row", gap: 10, marginHorizontal: 20, marginBottom: 20 },
    recordBtn:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: colors.radius, paddingVertical: 13, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1.5, borderColor: colors.primary },
    recordBtnText:   { color: colors.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    uploadBtn:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 13, paddingHorizontal: 16, justifyContent: "center" },
    uploadBtnText:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    card:            { backgroundColor: colors.card, borderRadius: colors.radius, marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    cardLeft:        { width: 4, alignSelf: "stretch" },
    cardBody:        { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingRight: 16 },
    iconBg:          { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    cardTitle:       { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    cardMeta:        { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "capitalize" },
    scoreCircle:     { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreText:       { fontSize: 15, fontFamily: "Inter_700Bold" },
    processingBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.primary + "22" },
    processingText:  { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.primary },
    failedBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: colors.destructive + "22" },
    failedText:      { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.destructive },
    empty:           { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 64 },
    emptyIcon:       { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 18 },
    emptyTitle:      { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 },
    emptyText:       { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
    emptyBtn:        { marginTop: 22, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
    emptyBtnText:    { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    noResults:       { paddingVertical: 32, alignItems: "center" },
    noResultsText:   { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    // Processing overlay
    overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 32 },
    overlayCard:     { backgroundColor: colors.card, borderRadius: 24, padding: 32, alignItems: "center", width: "100%", gap: 6 },
    overlayTitle:    { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 16, marginBottom: 4 },
    overlayStep:     { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
    stepDots:        { flexDirection: "row", gap: 8, marginTop: 20, marginBottom: 4 },
    stepDot:         { width: 8, height: 8, borderRadius: 4 },
    // Sport picker modal
    pickerModal:     { flex: 1, backgroundColor: colors.background },
    pickerHeader:    { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    pickerContent:   { flex: 1, padding: 20 },
    pickerLabel:     { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 8 },
    pickerInput:     { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 20 },
    sportGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 28 },
    sportChip:       { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    sportChipSel:    { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    sportChipText:   { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sportChipTextSel:{ color: colors.primary },
    analyzeBtn:      { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    analyzeBtnDis:   { opacity: 0.45 },
    analyzeBtnText:  { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    limitRow:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingBottom: 12 },
    limitText:       { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    limitBold:       { fontFamily: "Inter_600SemiBold", color: colors.foreground },
  });

  const ListHeader = (
    <>
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.title}>Analyses</Text>
          <TouchableOpacity onPress={handleUpload} activeOpacity={0.85}
            style={{ backgroundColor: colors.primary, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="plus" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {headerStats.total > 0 && (
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Text style={s.statVal}>{headerStats.total}</Text>
              <Text style={s.statLbl}>Total</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statVal}>{headerStats.thisWeek}</Text>
              <Text style={s.statLbl}>This Week</Text>
            </View>
            <View style={[s.statPill]}>
              <Text style={[s.statVal, { color: getScoreColor(headerStats.avg, colors) }]}>{headerStats.avg}</Text>
              <Text style={s.statLbl}>Avg Score</Text>
            </View>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by title or sport…"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortRow} contentContainerStyle={{ gap: 8 }}>
        {sortOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.sortChip, sortBy === opt.key && s.sortChipActive]}
            onPress={() => setSortBy(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.sortChipText, sortBy === opt.key && s.sortChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Action row — only when no search query */}
      {!searchQuery && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.recordBtn} onPress={handleRecord} activeOpacity={0.85}>
            <Feather name="video" size={15} color={colors.primary} />
            <Text style={s.recordBtnText}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={handleUpload} activeOpacity={0.85}>
            <Feather name="upload" size={15} color="#fff" />
            <Text style={s.uploadBtnText}>Upload Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Limit indicator */}
      {!canUnlimited && (
        <View style={s.limitRow}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={s.limitText}>
            <Text style={s.limitBold}>{Math.min(headerStats.total, 3)}/3</Text> free analyses used
            {headerStats.total >= 3 ? " — " : ""}
            {headerStats.total >= 3 && (
              <Text style={{ color: colors.primary }} onPress={() => router.push("/pricing")}>
                Upgrade for unlimited
              </Text>
            )}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={s.container}>
      {/* Processing overlay */}
      <Modal visible={analyzing} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.overlayCard}>
            <Feather name={ANALYSIS_STEPS[analysisStep]?.icon as any ?? "cpu"} size={36} color={colors.primary} />
            <Text style={s.overlayTitle}>Analyzing your video…</Text>
            <Text style={s.overlayStep}>{ANALYSIS_STEPS[analysisStep]?.label}</Text>
            <View style={s.stepDots}>
              {ANALYSIS_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.stepDot,
                    { backgroundColor: i <= analysisStep ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Sport/title picker modal */}
      <Modal visible={showSportPicker} animationType="slide">
        <View style={s.pickerModal}>
          <View style={s.pickerHeader}>
            <TouchableOpacity onPress={() => setShowSportPicker(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.pickerTitle}>Analysis Details</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView style={s.pickerContent} keyboardShouldPersistTaps="handled">
            <Text style={[s.pickerLabel, { marginTop: 4 }]}>Title (optional)</Text>
            <TextInput
              style={s.pickerInput}
              value={pendingTitle}
              onChangeText={setPendingTitle}
              placeholder="e.g. Deadlift PR attempt, Race pace run…"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Text style={s.pickerLabel}>Sport *</Text>
            <View style={s.sportGrid}>
              {SPORTS.map((sport) => {
                const sel = selectedSport.toLowerCase() === sport.toLowerCase();
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[s.sportChip, sel && s.sportChipSel]}
                    onPress={() => setSelectedSport(sport)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.sportChipText, sel && s.sportChipTextSel]}>{sport}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[s.analyzeBtn, !selectedSport && s.analyzeBtnDis]}
              onPress={submitAnalysis}
              disabled={!selectedSport}
              activeOpacity={0.85}
            >
              <Text style={s.analyzeBtnText}>
                {selectedSport ? `Analyze ${selectedSport} Video` : "Select a sport first"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <FlatList
        data={displayList}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAnalyses(); }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <View style={s.empty}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : searchQuery ? (
            <View style={s.noResults}>
              <Feather name="search" size={24} color={colors.mutedForeground} />
              <Text style={[s.noResultsText, { marginTop: 10 }]}>No results for "{searchQuery}"</Text>
            </View>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Feather name="video" size={30} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>No analyses yet</Text>
              <Text style={s.emptyText}>
                Upload or record a training video and get AI-powered biomechanics coaching in seconds.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={handleUpload} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Upload Your First Video</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isProcessing = item.status === "processing" || item.status === "pending";
          const score = item.overallScore ?? 0;
          const scoreColor = getScoreColor(score, colors);
          const accent = getSportAccent(item.sport, colors.primary);

          return (
            <TouchableOpacity
              style={[s.card, { flexDirection: "row" }]}
              onPress={() => !isProcessing && router.push(`/analysis/${item.id}`)}
              activeOpacity={isProcessing ? 1 : 0.82}
            >
              <View style={[s.cardLeft, { backgroundColor: accent }]} />
              <View style={[s.cardBody, { paddingLeft: 14 }]}>
                <View style={[s.iconBg, { backgroundColor: accent + "22" }]}>
                  <Feather name="activity" size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.cardMeta}>
                    {item.sport} · {formatDate(item.uploadedAt)}
                    {item.duration ? ` · ${Math.round(item.duration)}s` : ""}
                  </Text>
                </View>
                {isProcessing ? (
                  <View style={s.processingBadge}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={s.processingText}>AI</Text>
                  </View>
                ) : item.status === "failed" ? (
                  <View style={s.failedBadge}>
                    <Text style={s.failedText}>Failed</Text>
                  </View>
                ) : (
                  <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
                    <Text style={[s.scoreText, { color: scoreColor }]}>{Math.round(score)}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      />
    </View>
  );
}
