import { useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Router } from "expo-router";
import { analyses as analysesApi, ApiError } from "@/lib/api";
import type { Profile } from "@/lib/api";
import { RECORDING_TIPS_KEY } from "@/components/RecordingTipsModal";

function getWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

const ANALYSIS_STEPS = [
  { label: "Scanning your video",          icon: "film",      color: "#2F7BFF" },
  { label: "Finding the athlete",          icon: "user",      color: "#2F7BFF" },
  { label: "Tracking movement",            icon: "activity",  color: "#2F7BFF" },
  { label: "Measuring key positions",      icon: "target",    color: "#22C55E" },
  { label: "Building your coaching plan",  icon: "cpu",       color: "#FF6B35" },
];

export { ANALYSIS_STEPS };

export interface UseVideoUploadResult {
  showSportPicker: boolean;
  setShowSportPicker: React.Dispatch<React.SetStateAction<boolean>>;
  pendingUri: string | null;
  pendingTitle: string;
  setPendingTitle: React.Dispatch<React.SetStateAction<string>>;
  selectedSport: string;
  setSelectedSport: React.Dispatch<React.SetStateAction<string>>;
  analyzing: boolean;
  analysisStep: number;
  showRecordingTips: boolean;
  setShowRecordingTips: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAction: "upload" | "record" | null;
  handleUpload: () => Promise<void>;
  handleRecord: () => Promise<void>;
  handleRecordingTipsContinue: () => Promise<void>;
  submitAnalysis: () => Promise<void>;
}

export function useVideoUpload(
  profile: Profile | null | undefined,
  headerStats: { thisWeek: number },
  loadAnalyses: () => Promise<void>,
  router: Router,
): UseVideoUploadResult {
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [showRecordingTips, setShowRecordingTips] = useState(false);
  const [pendingAction, setPendingAction] = useState<"upload" | "record" | null>(null);

  function requireSport(): boolean {
    if (!profile?.sport) {
      Alert.alert(
        "Set your sport first",
        "Tell us your sport so we can give you accurate, sport-specific biomechanics feedback.",
        [
          { text: "Skip for now", style: "cancel" },
          { text: "Set up profile", onPress: () => (router as any).push("/onboarding") },
        ]
      );
      return false;
    }
    return true;
  }

  async function doUpload() {
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

  async function doRecord() {
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

  const handleUpload = useCallback(async () => {
    if (!requireSport()) return;
    const dismissed = await AsyncStorage.getItem(RECORDING_TIPS_KEY);
    if (dismissed) {
      await doUpload();
    } else {
      setPendingAction("upload");
      setShowRecordingTips(true);
    }
  }, [profile]);

  const handleRecord = useCallback(async () => {
    if (!requireSport()) return;
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Video recording is only available on the mobile app.");
      return;
    }
    const dismissed = await AsyncStorage.getItem(RECORDING_TIPS_KEY);
    if (dismissed) {
      await doRecord();
    } else {
      setPendingAction("record");
      setShowRecordingTips(true);
    }
  }, [profile]);

  const handleRecordingTipsContinue = useCallback(async () => {
    setShowRecordingTips(false);
    if (pendingAction === "upload") {
      await doUpload();
    } else if (pendingAction === "record") {
      await doRecord();
    }
    setPendingAction(null);
  }, [pendingAction]);

  const submitAnalysis = useCallback(async () => {
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

      const weeklyGoal = profile?.weeklyGoal ?? 3;
      if (weeklyGoal > 0 && headerStats.thisWeek < weeklyGoal && headerStats.thisWeek + 1 >= weeklyGoal) {
        const weekKey = getWeekKey();
        const alreadyCelebrated = await AsyncStorage.getItem(`confetti_celebrated_${weekKey}`);
        if (!alreadyCelebrated) {
          await AsyncStorage.setItem(`confetti_pending_${weekKey}`, "true");
        }
      }

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 500));
      setAnalyzing(false);
      await loadAnalyses();
      (router as any).push(`/analysis/${analysis.id}`);
    } catch (err) {
      clearInterval(stepInterval);
      setAnalyzing(false);
      if (err instanceof ApiError && err.code === "UPGRADE_REQUIRED") {
        Alert.alert(
          "Upgrade Required",
          err.message,
          [
            { text: "Not now", style: "cancel" },
            { text: "View Plans", onPress: () => (router as any).push("/pricing") },
          ]
        );
      } else {
        Alert.alert("Something went wrong", "Please try again.");
      }
    }
  }, [selectedSport, pendingUri, pendingTitle, profile, headerStats, loadAnalyses, router]);

  return {
    showSportPicker, setShowSportPicker, pendingUri, pendingTitle, setPendingTitle,
    selectedSport, setSelectedSport, analyzing, analysisStep,
    showRecordingTips, setShowRecordingTips, pendingAction,
    handleUpload, handleRecord, handleRecordingTipsContinue, submitAnalysis,
  };
}
