import React, { useState, useEffect, useCallback } from "react";
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
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { analyses as analysesApi, type AnalysisRecord, ApiError } from "@/lib/api";
import { useAuth, useCanAccessFeature } from "@/lib/authContext";
import Svg, { Circle as SvgCircle } from "react-native-svg";

const SPORTS = [
  "Weightlifting", "Running", "Basketball", "Golf", "Tennis",
  "Swimming", "CrossFit", "Boxing", "Soccer", "Gymnastics", "Other",
];

const ANALYSIS_STEPS = [
  "Extracting video frames...",
  "Detecting body pose...",
  "Calculating joint angles...",
  "Running AI analysis...",
  "Generating report...",
];

function getScoreColor(score: number, colors: ReturnType<typeof useColors>) {
  if (score >= 80) return colors.success;
  if (score >= 65) return colors.primary;
  return colors.warning;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  // Sport picker modal state
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [selectedSport, setSelectedSport] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

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

  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  // Poll for processing analyses
  useEffect(() => {
    const processing = analysisList.some((a) => a.status === "processing" || a.status === "pending");
    if (!processing) return;
    const interval = setInterval(loadAnalyses, 5000);
    return () => clearInterval(interval);
  }, [analysisList, loadAnalyses]);

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
          ? "This clip is in iCloud and hasn't downloaded yet. Open Photos, let it download fully, then try again."
          : "Something went wrong. Please try a different clip.",
      );
    }
  }

  async function submitAnalysis() {
    if (!selectedSport || !pendingUri) return;
    setShowSportPicker(false);
    setAnalyzing(true);
    setAnalysisStep(0);

    // Animate steps while API processes
    const stepInterval = setInterval(() => {
      setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 900);

    try {
      const { analysis } = await analysesApi.create({
        title: pendingTitle.trim() || `${selectedSport} — Analysis`,
        sport: selectedSport.toLowerCase(),
        videoUrl: pendingUri,
      });

      // Persist the local video URI so the skeleton overlay can find it later
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

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 20 },
    title: { fontSize: 28, fontFamily: "Archivo_800ExtraBold", color: colors.foreground, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    uploadBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 14, paddingHorizontal: 20, marginHorizontal: 20, marginBottom: 20, justifyContent: "center" },
    uploadBtnText: { color: "#07090B", fontSize: 15, fontFamily: "Inter_700Bold" },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    cardBody: { padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
    iconBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" },
    cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    cardMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, textTransform: "capitalize" },
    scoreCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", borderWidth: 2 },
    scoreText: { fontSize: 16, fontFamily: "Archivo_800ExtraBold" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 },
    emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
    // Processing overlay
    overlay: { flex: 1, backgroundColor: "#07090B", paddingTop: topPad + 16, paddingHorizontal: 20 },
    overlayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    overlayClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
    overlayHeaderTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 2 },
    videoBg: {
      height: 180, borderRadius: 16, backgroundColor: "#141414",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
      alignItems: "center", justifyContent: "center", gap: 10,
      overflow: "hidden",
    },
    sportBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: "#07090B", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1, borderColor: colors.primary + "44",
    },
    sportBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary, letterSpacing: 1 },
    uploadedLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 2 },
    progressPct: { fontSize: 22, fontFamily: "Archivo_800ExtraBold", color: "#FFFFFF" },
    progressLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 1.5, marginTop: 2 },
    stepList: { gap: 16, paddingHorizontal: 4 },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepIcon: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#2A2A2A", alignItems: "center", justifyContent: "center" },
    stepIconDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    stepIconActive: { borderColor: colors.primary },
    stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    stepText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 },
    // Sport picker modal
    pickerModal: { flex: 1, backgroundColor: colors.background },
    pickerHeader: { paddingTop: topPad + 16, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    pickerContent: { flex: 1, padding: 20 },
    pickerLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 8 },
    pickerInput: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 20 },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
    sportChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    sportChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
    sportChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sportChipTextSelected: { color: colors.primary },
    analyzeBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
    analyzeBtnDisabled: { opacity: 0.5 },
    analyzeBtnText: { color: "#07090B", fontSize: 16, fontFamily: "Inter_700Bold" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  });

  return (
    <View style={s.container}>
      {/* Processing overlay */}
      {(() => {
        const progress     = ANALYSIS_STEPS.length > 1 ? (analysisStep / (ANALYSIS_STEPS.length - 1)) * 100 : 0;
        const RADIUS       = 45;
        const CIRC         = 2 * Math.PI * RADIUS;
        const dashOffset   = CIRC - (progress / 100) * CIRC;
        const vStepCount   = 4;
        const visualStep   = Math.min(Math.floor((analysisStep / (ANALYSIS_STEPS.length - 1)) * vStepCount), vStepCount - 1);

        const VSTEPS = [
          { label: "Sport detected",          detail: selectedSport || "Running" },
          { label: "Pose estimated",           detail: "6 joints" },
          { label: "Measuring joint angles",   detail: "" },
          { label: "Grounding coaching tips",  detail: "" },
        ];

        return (
          <Modal visible={analyzing} transparent={false} animationType="fade">
            <View style={s.overlay}>
              {/* Header */}
              <View style={s.overlayHeader}>
                <TouchableOpacity onPress={() => {}} style={s.overlayClose} activeOpacity={0.7}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={s.overlayHeaderTitle}>ANALYSING</Text>
                <View style={{ width: 36 }} />
              </View>

              {/* Video placeholder */}
              <View style={s.videoBg}>
                <View style={s.sportBadge}>
                  <Feather name="zap" size={12} color={colors.primary} />
                  <Text style={s.sportBadgeText}>{(selectedSport || "Running").toUpperCase()} {Math.round(progress)}%</Text>
                </View>
                <Text style={s.uploadedLabel}>UPLOADED CLIP</Text>
              </View>

              {/* Circular progress */}
              <View style={{ alignItems: "center", marginVertical: 28 }}>
                <Svg width={130} height={130} viewBox="0 0 120 120">
                  <SvgCircle cx="60" cy="60" r={RADIUS} fill="none" stroke="#2A2A2A" strokeWidth="8" />
                  <SvgCircle
                    cx="60" cy="60" r={RADIUS}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="8"
                    strokeDasharray={`${CIRC} ${CIRC}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    rotation="-90"
                    origin="60, 60"
                  />
                </Svg>
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                  <Text style={s.progressPct}>{Math.round(progress)}%</Text>
                  <Text style={s.progressLabel}>EXTRACTING</Text>
                </View>
              </View>

              {/* Step checklist */}
              <View style={s.stepList}>
                {VSTEPS.map((vs, i) => {
                  const isDone   = i < visualStep;
                  const isActive = i === visualStep;
                  return (
                    <View key={i} style={s.stepRow}>
                      <View style={[s.stepIcon, isDone && s.stepIconDone, isActive && s.stepIconActive]}>
                        {isDone   && <Feather name="check" size={11} color="#07090B" />}
                        {isActive && <View style={s.stepDotInner} />}
                      </View>
                      <Text style={[s.stepText, (isDone || isActive) && { color: colors.foreground }]}>
                        {vs.label}{vs.detail ? ` — ${vs.detail}` : ""}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Modal>
        );
      })()}

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
              placeholder="e.g. Deadlift 180kg"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
            <Text style={s.pickerLabel}>Sport</Text>
            <View style={s.sportGrid}>
              {SPORTS.map((sport) => {
                const sel = selectedSport.toLowerCase() === sport.toLowerCase();
                return (
                  <TouchableOpacity
                    key={sport}
                    style={[s.sportChip, sel && s.sportChipSelected]}
                    onPress={() => setSelectedSport(sport)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.sportChipText, sel && s.sportChipTextSelected]}>{sport}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[s.analyzeBtn, !selectedSport && s.analyzeBtnDisabled]}
              onPress={submitAnalysis}
              disabled={!selectedSport}
              activeOpacity={0.85}
            >
              <Text style={s.analyzeBtnText}>Analyze Video</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <FlatList
        data={analysisList}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalyses(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <Text style={s.title}>Analyses</Text>
              <Text style={s.subtitle}>
                {canUnlimited ? "Unlimited" : `${analysisList.length}/3`} analyses used
              </Text>
            </View>
            <TouchableOpacity style={s.uploadBtn} onPress={handleUpload} activeOpacity={0.85}>
              <Feather name="upload" size={18} color={colors.primaryForeground} />
              <Text style={s.uploadBtnText}>Upload Training Video</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.empty}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Feather name="video" size={28} color={colors.primary} />
              </View>
              <Text style={s.emptyTitle}>No analyses yet</Text>
              <Text style={s.emptyText}>Upload a training video and get AI-powered biomechanics analysis in seconds.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isProcessing = item.status === "processing" || item.status === "pending";
          const score = item.overallScore ?? 0;
          const scoreColor = getScoreColor(score, colors);
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => !isProcessing && router.push(`/analysis/${item.id}`)}
              activeOpacity={isProcessing ? 1 : 0.85}
            >
              <View style={s.cardBody}>
                <View style={s.iconBg}>
                  <Feather name="activity" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.cardMeta}>{item.sport} · {formatDate(item.uploadedAt)}</Text>
                </View>
                {isProcessing ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : item.status === "failed" ? (
                  <Feather name="alert-circle" size={22} color={colors.destructive} />
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
