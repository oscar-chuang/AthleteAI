import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Modal,
  PanResponder,
  Dimensions,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system";
import { useSharePreview } from "@/hooks/useSharePreview";
import { useCardStagger } from "@/hooks/useCardStagger";

import { useColors } from "@/hooks/useColors";
import { formatBiomechanicsText } from "@/utils/formatBiomechanics";
import {
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY_THRESHOLD,
  resolveAdjacentIds,
  shouldActivateSwipe,
  resolveSwipeDirection,
  resolveSwipeTranslation,
} from "@/utils/swipeNavigation";
import {
  analyses as analysesApi,
  profile as profileApi,
  type AnalysisRecord,
  type TipRecord,
  type RiskRecord,
} from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoreCard, getScoreBand } from "@/components/analysis/ScoreCard";
import { SectionHeader } from "@/components/analysis/SectionHeader";
import { NextFocusCard } from "@/components/analysis/NextFocusCard";
import { AnimatedLoadingState } from "@/components/analysis/AnimatedLoadingState";
import { ShareCard, SHARE_CARD_DARK, SHARE_CARD_LIGHT } from "@/components/analysis/ShareCard";
import {
  SHARE_CARD_CAPTURE_OPTIONS,
  HIDDEN_SHARE_CARD_STYLE,
} from "@/utils/shareCardCapture";
import { buildSessionSharePayload } from "@/utils/shareUtils";

const PENDING_CHAT_KEY = "pendingChatMessage";
const SWIPE_HINT_SEEN_KEY = "swipe_hint_seen";
const LAST_SHARE_ACTION_KEY = "lastShareAction";
const SHARE_CARD_SCHEME_KEY = "shareCardScheme";

// Module-level: tracks which analysis IDs have already completed their first ring animation.
// Persists across component re-mounts (session navigation), so switching sessions and coming
// back never replays the stagger — and re-focusing the tab never re-fires it either.
const ringAnimationDone = new Set<string>();

function getWeekKey(): string {
  const d = new Date();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().split("T")[0]!;
}

const SCORE_KEYS = [
  "technique",
  "power",
  "balance",
  "consistency",
  "mobility",
  "speed",
] as const;

const SCORE_META: Record<
  (typeof SCORE_KEYS)[number],
  { icon: React.ComponentProps<typeof Feather>["name"]; desc: string }
> = {
  technique: {
    icon: "target",
    desc: "How closely your form matches ideal movement patterns for your sport",
  },
  power: {
    icon: "zap",
    desc: "The strength and explosiveness behind your movements",
  },
  balance: {
    icon: "activity",
    desc: "How stable and controlled you are through each movement",
  },
  consistency: {
    icon: "refresh-cw",
    desc: "How repeatable your technique is from rep to rep",
  },
  mobility: {
    icon: "maximize-2",
    desc: "Your range of motion and flexibility in key joints",
  },
  speed: {
    icon: "wind",
    desc: "How quickly and efficiently you execute movements",
  },
};

const SEVERITY_CONFIG = {
  info: { color: "#38bdf8", icon: "info" as const, label: "Info" },
  warning: {
    color: "#f59e0b",
    icon: "alert-triangle" as const,
    label: "Warning",
  },
  critical: {
    color: "#ef4444",
    icon: "alert-circle" as const,
    label: "Critical",
  },
};

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  low:      { label: "Low Risk",      color: "#22c55e" },
  moderate: { label: "Moderate Risk", color: "#f59e0b" },
  high:     { label: "High Risk",     color: "#ef4444" },
};

const JOINT_LABEL: Record<string, string> = {
  leftKnee:   "Left Knee",
  rightKnee:  "Right Knee",
  leftHip:    "Left Hip",
  rightHip:   "Right Hip",
  leftElbow:  "Left Elbow",
  rightElbow: "Right Elbow",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function scoreForKey(
  analysis: AnalysisRecord,
  key: (typeof SCORE_KEYS)[number]
): number {
  return (analysis as any)[`${key}Score`] ?? 0;
}

function getRiskLabel(pct: number) {
  if (pct >= 50) return RISK_LABEL.high;
  if (pct >= 30) return RISK_LABEL.moderate;
  return RISK_LABEL.low;
}

// ── Animated risk bar ──────────────────────────────────────────────────────────
function AnimatedRiskBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 600,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={{ height: 7, backgroundColor: color + "22", borderRadius: 4, marginVertical: 8 }}>
      <Animated.View
        style={{
          height: 7,
          borderRadius: 4,
          backgroundColor: color,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

// ── Press-scale button wrapper ─────────────────────────────────────────────────
function ScaleButton({
  onPress,
  style,
  children,
  activeOpacity = 0.75,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
  activeOpacity?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={activeOpacity}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Error / state screens ──────────────────────────────────────────────────────
function StateScreen({
  icon,
  iconColor,
  heading,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  iconColor: string;
  heading: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 36,
        gap: 0,
      }}
    >
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: iconColor + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Feather name={icon} size={30} color={iconColor} />
      </View>
      <Text
        style={{
          fontSize: 19,
          fontFamily: "Inter_700Bold",
          color: colors.foreground,
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        {heading}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          textAlign: "center",
          lineHeight: 21,
          marginBottom: 28,
        }}
      >
        {body}
      </Text>
      <ScaleButton
        onPress={onPrimary}
        style={{
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 7,
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 13,
          paddingHorizontal: 26,
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 15,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {primaryLabel}
        </Text>
      </ScaleButton>
      {secondaryLabel && onSecondary && (
        <TouchableOpacity onPress={onSecondary} activeOpacity={0.7}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
            }}
          >
            {secondaryLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Tab constants & seed helper ────────────────────────────────────────────────
export const VALID_TABS = ["scores", "tips", "risks", "notes"] as const;
export type AnalysisTab = (typeof VALID_TABS)[number];

/**
 * Derives the initial active tab from the raw `tab` query-param value.
 * Falls back to "scores" when the param is absent or not one of the valid tabs.
 * Exported so unit tests can exercise it without rendering the full screen.
 */
export function seedActiveTab(param: string | string[] | undefined): AnalysisTab {
  const raw = Array.isArray(param) ? param[0] : param;
  return (VALID_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as AnalysisTab)
    : "scores";
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function AnalysisDetailScreen() {
  const { id, tab: rawTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { profile } = useAuth();

  // Active tab — seeded from the ?tab= query param so it survives rotation /
  // backgrounding (expo-router re-reads params on remount).
  const [activeTab, setActiveTab] = useState<AnalysisTab>(() => seedActiveTab(rawTab));

  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedTip, setExpanded] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastShareAction, setLastShareAction] = useState<"save" | "share">("share");
  const [selectedShareTipId, setSelectedShareTipId] = useState<string | null>(null);
  const [shareScheme, setShareScheme] = useState<"dark" | "light">("dark");

  // Load persisted share card scheme on mount
  useEffect(() => {
    AsyncStorage.getItem(SHARE_CARD_SCHEME_KEY).then((saved) => {
      if (saved === "dark" || saved === "light") setShareScheme(saved);
    }).catch(() => {});
  }, []);
  const shareCardRef = useRef<View>(null);
  // Remembers the last tip the user picked on the share sheet, keyed by analysis ID.
  // Survives modal close/reopen within the same screen session; not persisted across restarts.
  const shareTipMemoryRef = useRef<Record<string, string | null>>({});
  const {
    showSharePreview,
    handleShare: _openSharePreview,
    handleCancelShare,
  } = useSharePreview();

  // Goal reached toast
  const [goalToast, setGoalToast] = useState<{ count: number; goal: number } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(60)).current;
  const prevStatusRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sub-score ring scroll-in animation state
  const [cardsVisible, setCardsVisible] = useState(false);
  const cardAnimated = useCardStagger(
    cardsVisible,
    SCORE_KEYS.length,
    !!(analysis?.id && ringAnimationDone.has(analysis.id)),
  );
  const scoreGridY = useRef<number | null>(null);
  // Height of the ScrollView's visible area — used to auto-trigger rings when
  // the grid is already within the initial viewport at scroll y=0.
  const scrollViewHeight = useRef<number>(0);

  // Sibling session IDs for prev/next navigation — sorted newest-first
  const [siblingIds, setSiblingIds] = useState<string[]>([]);

  // ── Swipe hint (one-time discovability) ──
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const swipeHintVisible = useRef(false);
  const dismissHintRef = useRef<() => void>(() => {});
  const showHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // When cardsVisible fires for the first time for this analysis, register it
  // in ringAnimationDone so return visits show all rings instantly (the
  // instant=true path in useCardStagger) without replaying the stagger.
  useEffect(() => {
    if (!cardsVisible || !analysis?.id || ringAnimationDone.has(analysis.id)) return;
    ringAnimationDone.add(analysis.id);
  }, [cardsVisible, analysis?.id]);

  // Hero fade-in
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!loading && analysis) {
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, analysis]);

  // Load persisted note
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`note_${id}`).then((saved) => {
      if (saved) setNote(saved);
    });
  }, [id]);

  // Load last-used share action preference
  useEffect(() => {
    AsyncStorage.getItem(LAST_SHARE_ACTION_KEY).then((saved) => {
      if (saved === "save" || saved === "share") setLastShareAction(saved);
    }).catch(() => {});
  }, []);

  // Load sibling IDs for prev/next navigation (newest first, complete only)
  useEffect(() => {
    analysesApi.list().then(({ analyses: all }) => {
      const ordered = [...all]
        .filter((a) => a.status === "complete")
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
        .map((a) => a.id);
      setSiblingIds(ordered);
    }).catch(() => {});
  }, []);

  const { currIndex, prevId, nextId } = resolveAdjacentIds(siblingIds, id);

  function navigateTo(targetId: string) {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    router.replace(`/analysis/${targetId}?tab=${activeTab}` as any);
  }

  // ── Swipe gesture for session navigation ──────────────────────────────────
  const SCREEN_WIDTH = Dimensions.get("window").width;

  const swipeAnim = useRef(new Animated.Value(0)).current;

  // ── Swipe hint logic ──────────────────────────────────────────────────────
  function dismissSwipeHint() {
    // Cancel any pending show / auto-dismiss timers so a swipe that happens
    // before the 700 ms delay or during the 2 s window never shows the hint.
    if (showHintTimerRef.current !== null) {
      clearTimeout(showHintTimerRef.current);
      showHintTimerRef.current = null;
    }
    if (autoHintTimerRef.current !== null) {
      clearTimeout(autoHintTimerRef.current);
      autoHintTimerRef.current = null;
    }
    if (!swipeHintVisible.current) return;
    swipeHintVisible.current = false;
    Animated.timing(swipeHintOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
    AsyncStorage.setItem(SWIPE_HINT_SEEN_KEY, "true").catch(() => {});
  }

  // Register dismiss so the PanResponder (created once) can call it via ref.
  dismissHintRef.current = dismissSwipeHint;

  // Show the hint once siblings are known and hint has not been seen.
  useEffect(() => {
    if (siblingIds.length < 2) return;
    const myIndex = siblingIds.indexOf(id ?? "");
    const hasNeighbour =
      myIndex > 0 || (myIndex >= 0 && myIndex < siblingIds.length - 1);
    if (!hasNeighbour) return;

    // cancelled guards against the async storage read completing after the
    // effect has been cleaned up (e.g. component unmounts mid-flight).
    let cancelled = false;

    AsyncStorage.getItem(SWIPE_HINT_SEEN_KEY).then((seen) => {
      if (seen || cancelled) return;
      swipeHintVisible.current = true;
      showHintTimerRef.current = setTimeout(() => {
        showHintTimerRef.current = null;
        if (cancelled || !swipeHintVisible.current) return;
        Animated.timing(swipeHintOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          if (cancelled || !swipeHintVisible.current) return;
          autoHintTimerRef.current = setTimeout(() => {
            autoHintTimerRef.current = null;
            dismissHintRef.current();
          }, 2000);
        });
      }, 700);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (showHintTimerRef.current !== null) {
        clearTimeout(showHintTimerRef.current);
        showHintTimerRef.current = null;
      }
      if (autoHintTimerRef.current !== null) {
        clearTimeout(autoHintTimerRef.current);
        autoHintTimerRef.current = null;
      }
    };
  }, [siblingIds]);

  // Keep a mutable ref so the PanResponder closure (created once) always sees
  // the latest prevId / nextId without needing to be recreated.
  const navRef = useRef<{ prevId: string | null; nextId: string | null }>({
    prevId: null,
    nextId: null,
  });
  useEffect(() => {
    navRef.current = { prevId, nextId };
  }, [prevId, nextId]);

  // Keep router in a ref for the same reason.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const panResponder = useRef(
    PanResponder.create({
      // Only capture when horizontal movement clearly dominates vertical.
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        shouldActivateSwipe(dx, dy),
      onPanResponderMove: (_, { dx }) => {
        const { prevId: pId, nextId: nId } = navRef.current;
        swipeAnim.setValue(resolveSwipeTranslation(dx, pId, nId));
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const { prevId: pId, nextId: nId } = navRef.current;
        const direction = resolveSwipeDirection(dx, vx, pId, nId);
        const goNext = direction === "next";
        const goPrev = direction === "prev";

        if (goNext) {
          dismissHintRef.current();
          Animated.timing(swipeAnim, {
            toValue: -SCREEN_WIDTH,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            swipeAnim.setValue(0);
            routerRef.current.replace(`/analysis/${nId}` as any);
          });
        } else if (goPrev) {
          dismissHintRef.current();
          Animated.timing(swipeAnim, {
            toValue: SCREEN_WIDTH,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            swipeAnim.setValue(0);
            routerRef.current.replace(`/analysis/${pId}` as any);
          });
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
            speed: 25,
            bounciness: 4,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 25,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleAskCoach() {
    if (!analysis) return;
    const worst = SCORE_KEYS.map((k) => ({
      key: k,
      score: scoreForKey(analysis, k),
    })).sort((a, b) => a.score - b.score)[0];
    const msg = `I just reviewed my "${analysis.title}" (${analysis.sport}) session. My overall score was ${Math.round(analysis.overallScore ?? 0)}/100. My weakest area is ${worst?.key ?? "technique"} (${Math.round(worst?.score ?? 0)}). What's the single most impactful thing I can do to improve?`;
    await AsyncStorage.setItem(PENDING_CHAT_KEY, msg);
    router.push("/(tabs)/chat" as any);
  }

  function handleShare() {
    if (!analysis) return;
    // Use the previously chosen tip for this analysis if the user has already picked one;
    // otherwise fall back to the highest-severity tip.
    const remembered = shareTipMemoryRef.current[analysis.id];
    const initialTip = remembered !== undefined ? remembered : (topTip?.id ?? null);
    setSelectedShareTipId(initialTip);
    _openSharePreview();
  }

  async function handleDoShare() {
    if (!analysis || sharing) return;
    setSharing(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Your device doesn't support sharing.");
        return;
      }
      const uri = await captureRef(shareCardRef, SHARE_CARD_CAPTURE_OPTIONS);
      handleCancelShare();

      const payload = buildSessionSharePayload(id ?? "", analysis.sport ?? "", uri);

      if (Platform.OS === "ios") {
        await Share.share({ url: payload.url, message: payload.message });
      } else {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.SEND", {
          type: "image/png",
          extra: {
            "android.intent.extra.STREAM": contentUri,
            "android.intent.extra.TEXT": payload.message,
            "android.intent.extra.SUBJECT": `My ${analysis.sport} session on AthleteAI`,
          },
          flags: 1,
        });
      }
      setLastShareAction("share");
      AsyncStorage.setItem(LAST_SHARE_ACTION_KEY, "share").catch(() => {});
    } catch {
      Alert.alert("Couldn't share", "Something went wrong. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  async function handleSaveToPhotos() {
    if (!analysis || saving) return;
    if (Platform.OS === "web") return;
    setSaving(true);
    try {
      const MediaLibrary = await import("expo-media-library");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Please allow photo library access in your device settings to save images."
        );
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      setLastShareAction("save");
      AsyncStorage.setItem(LAST_SHARE_ACTION_KEY, "save").catch(() => {});
      Alert.alert("Saved!", "Your share card has been saved to your camera roll.");
    } catch {
      Alert.alert("Couldn't save", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      "Delete Analysis",
      "This will permanently remove this session and all its data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await analysesApi.delete(id!);
              router.back();
            } catch {
              setDeleting(false);
              Alert.alert("Error", "Failed to delete. Please try again.");
            }
          },
        },
      ]
    );
  }

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { analysis: a, tips: t, injuryRisks: r } = await analysesApi.get(id);
      setAnalysis(a);
      setTips(t);
      setRisks(r);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  function dismissToast() {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(toastTranslate, { toValue: 60, duration: 250, useNativeDriver: true }),
    ]).start(() => setGoalToast(null));
  }

  // Clean up auto-dismiss timer if component unmounts while toast is visible
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function checkGoalToast() {
    // Uses the same AsyncStorage keys and "just crossed" detection as the Home confetti
    const weekKey      = getWeekKey();
    const celebratedKey = `confetti_celebrated_${weekKey}`;
    const pendingKey    = `confetti_pending_${weekKey}`;
    const prevCountKey  = `confetti_prev_count_${weekKey}`;
    try {
      const [statsResult, profileResult] = await Promise.all([
        profileApi.stats(),
        profileApi.get(),
      ]);
      const currentCount = statsResult.thisWeekCount ?? 0;
      // Always use the freshest weeklyGoal from the server — the cached context
      // value may be stale if the user changed their goal mid-week in Settings.
      const weeklyGoal = profileResult.profile.weeklyGoal ?? profile?.weeklyGoal ?? 3;

      const [celebrated, pending, prevCountStr] = await Promise.all([
        AsyncStorage.getItem(celebratedKey),
        AsyncStorage.getItem(pendingKey),
        AsyncStorage.getItem(prevCountKey),
      ]);
      const prevCount = prevCountStr !== null ? parseInt(prevCountStr, 10) : null;

      // Mirror the Home screen's "just crossed" condition exactly:
      //   - an explicit pending flag written by analyze.tsx on upload, OR
      //   - the stored prev-count snapshot was below the goal
      const justCrossed =
        pending !== null ||
        (prevCount !== null && prevCount < weeklyGoal);

      if (!celebrated && weeklyGoal > 0 && currentCount >= weeklyGoal && justCrossed) {
        await Promise.all([
          AsyncStorage.setItem(celebratedKey, "true"),
          AsyncStorage.removeItem(pendingKey),
          AsyncStorage.setItem(prevCountKey, String(currentCount)),
        ]);
        setGoalToast({ count: currentCount, goal: weeklyGoal });
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(toastTranslate, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
        ]).start();
        toastTimerRef.current = setTimeout(() => dismissToast(), 3500);
      }
    } catch {
      // toast is non-critical — swallow errors silently
    }
  }

  // Detect the exact moment status transitions to 'complete' to fire the toast
  useEffect(() => {
    if (!analysis) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = analysis.status;
    if (analysis.status === "complete" && prev !== null && prev !== "complete") {
      checkGoalToast();
    }
  }, [analysis?.status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Poll while processing
  const isProcessing =
    !!analysis &&
    analysis.status !== "complete" &&
    analysis.status !== "failed";
  useEffect(() => {
    if (!isProcessing || pollExhausted) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 45) {
        clearInterval(timer);
        setPollExhausted(true);
        return;
      }
      load();
    }, 4000);
    return () => clearInterval(timer);
  }, [isProcessing, pollExhausted, load]);

  function getScoreColor(score: number) {
    if (score >= 80) return colors.success;
    if (score >= 65) return colors.primary;
    return colors.warning;
  }

  // ── Loading ──
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AnimatedLoadingState />
      </View>
    );
  }

  // ── Error ──
  if (error || !analysis) {
    return (
      <StateScreen
        icon="wifi-off"
        iconColor={colors.destructive}
        heading="Couldn't load analysis"
        body="We couldn't fetch this session. Check your connection and try again."
        primaryLabel="Try again"
        onPrimary={() => { setLoading(true); setError(false); load(); }}
        secondaryLabel="Go back"
        onSecondary={() => router.back()}
      />
    );
  }

  // ── Processing / pending ──
  if (analysis.status === "processing" || analysis.status === "pending") {
    if (pollExhausted) {
      return (
        <StateScreen
          icon="clock"
          iconColor={colors.warning}
          heading="Taking longer than usual"
          body="Your analysis is still processing in the background. You can check again or come back in a moment."
          primaryLabel="Check again"
          onPrimary={() => { setPollExhausted(false); load(); }}
          secondaryLabel="Go back"
          onSecondary={() => router.back()}
        />
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AnimatedLoadingState />
      </View>
    );
  }

  // ── Failed ──
  if (analysis.status === "failed") {
    return (
      <StateScreen
        icon="video-off"
        iconColor={colors.warning}
        heading="We couldn't process this video"
        body={"Try uploading a clearer clip — good lighting, a steady camera, and keeping the action within frame all help. Shorter clips (under 60 s) also work best."}
        primaryLabel="Try again"
        onPrimary={() => router.push("/(tabs)/analyze" as any)}
        secondaryLabel="Go back"
        onSecondary={() => router.back()}
      />
    );
  }

  // ── Derived values ──
  const overallScore = analysis.overallScore ?? 0;

  const rankedScores = SCORE_KEYS.map((k) => ({
    key: k,
    score: scoreForKey(analysis, k),
  })).sort((a, b) => a.score - b.score);

  const worstMetric = rankedScores[0];
  const bestMetric = rankedScores[rankedScores.length - 1];

  const sortedTips = [...tips].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  const topTip = sortedTips[0];

  // The tip shown on the share card — defaults to topTip, can be overridden by picker
  const selectedShareTip =
    sortedTips.find((t) => t.id === selectedShareTipId) ?? topTip;

  // Auto-expand top tip (critical/warning)
  const defaultExpandedId =
    expandedTip === null
      ? (sortedTips.find((t) => t.severity === "critical" || t.severity === "warning")?.id ?? sortedTips[0]?.id ?? null)
      : expandedTip;

  const firstDrill = tips.find((t) => t.drill)?.drill;

  // Summary: first 1–2 sentences from the first tip description
  const summaryText = (() => {
    if (!topTip) return null;
    const sentences = topTip.description.split(/(?<=\.)\s+/);
    return sentences.slice(0, 2).join(" ");
  })();

  const sportLabel =
    analysis.sport.charAt(0).toUpperCase() + analysis.sport.slice(1);

  const overallBand = getScoreBand(overallScore);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Navigation header ── */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 4,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.navBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
          <Text
            style={[styles.navBtnText, { color: colors.foreground }]}
          >
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.navCenter}>
          {/* ← prev */}
          <TouchableOpacity
            onPress={() => prevId && navigateTo(prevId)}
            disabled={!prevId}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Previous session"
            style={[
              styles.sessionNavBtn,
              { opacity: prevId ? 1 : 0.25 },
            ]}
          >
            <Feather name="chevron-left" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.navCenterBadgeCol}>
            <View
              style={[
                styles.sportBadge,
                { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" },
              ]}
            >
              <Text style={[styles.sportBadgeText, { color: colors.primary }]}>
                {sportLabel}
              </Text>
            </View>
            {siblingIds.length > 1 && currIndex >= 0 && (
              <Text style={[styles.sessionCounter, { color: colors.mutedForeground }]}>
                {currIndex + 1} of {siblingIds.length}
              </Text>
            )}
          </View>

          {/* next → */}
          <TouchableOpacity
            onPress={() => nextId && navigateTo(nextId)}
            disabled={!nextId}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Next session"
            style={[
              styles.sessionNavBtn,
              { opacity: nextId ? 1 : 0.25 },
            ]}
          >
            <Feather name="chevron-right" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <TouchableOpacity
            onPress={() => { if (analysis) handleShare(); }}
            activeOpacity={0.7}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel="Share analysis"
            style={{ padding: 6 }}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="share-2" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete analysis"
            style={{ padding: 6 }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Feather name="trash-2" size={18} color={colors.destructive} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Hidden share card — captured by react-native-view-shot.
          Style comes from HIDDEN_SHARE_CARD_STYLE (utils/shareCardCapture.ts).
          DO NOT swap back to top/left:-9999 — Android composits only on-screen
          views; off-screen placement produces a blank PNG. */}
      <View
        ref={shareCardRef}
        collapsable={false}
        pointerEvents="none"
        style={HIDDEN_SHARE_CARD_STYLE}
      >
        <ShareCard analysis={analysis} topTip={selectedShareTip?.title} colorScheme={shareScheme} />
      </View>

      {/* ── Share preview modal ── */}
      <Modal
        visible={showSharePreview}
        animationType="slide"
        transparent
        onRequestClose={handleCancelShare}
      >
        <View style={styles.shareModalBackdrop}>
          <View
            style={[
              styles.shareModalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Handle bar */}
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />

            <Text
              style={[styles.sheetTitle, { color: colors.foreground }]}
            >
              Share your session
            </Text>
            <Text
              style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}
            >
              Here's what others will see
            </Text>

            {/* Scheme picker — dark / light thumbnails */}
            <View style={styles.schemePicker}>
              {(["dark", "light"] as const).map((scheme) => {
                const pal      = scheme === "dark" ? SHARE_CARD_DARK : SHARE_CARD_LIGHT;
                const selected = shareScheme === scheme;
                return (
                  <TouchableOpacity
                    key={scheme}
                    onPress={() => {
                      setShareScheme(scheme);
                      AsyncStorage.setItem(SHARE_CARD_SCHEME_KEY, scheme).catch(() => {});
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.schemePill,
                      selected && { borderColor: colors.primary },
                    ]}
                  >
                    {/* Mini card */}
                    <View
                      style={[
                        styles.miniCard,
                        { backgroundColor: pal.cardBg, borderColor: pal.cardBorder },
                      ]}
                    >
                      <View
                        style={[styles.miniCardBar, { backgroundColor: pal.accent }]}
                      />
                      <View style={styles.miniCardLines}>
                        <View
                          style={[styles.miniCardLine, { backgroundColor: pal.textPrimary, width: "75%" }]}
                        />
                        <View
                          style={[styles.miniCardLine, { backgroundColor: pal.textMuted, width: "50%", marginTop: 4 }]}
                        />
                        <View
                          style={[styles.miniCardLine, { backgroundColor: pal.textMuted, width: "60%", marginTop: 4 }]}
                        />
                      </View>
                    </View>
                    {/* Label */}
                    <View style={styles.schemePillLabel}>
                      {selected && (
                        <Feather name="check-circle" size={11} color={colors.primary} />
                      )}
                      <Text
                        style={[
                          styles.schemePillText,
                          { color: selected ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {scheme === "dark" ? "Dark" : "Light"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Card preview */}
            <View style={styles.shareCardPreviewWrap}>
              <ShareCard analysis={analysis} topTip={selectedShareTip?.title} colorScheme={shareScheme} />
            </View>

            {/* Tip picker — only shown when there are multiple tips */}
            {sortedTips.length > 1 && (
              <View style={styles.tipPickerWrap}>
                <Text style={[styles.tipPickerLabel, { color: colors.mutedForeground }]}>
                  Choose which tip to feature
                </Text>
                <ScrollView
                  horizontal={false}
                  style={styles.tipPickerList}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {sortedTips.map((tip) => {
                    const isSelected = tip.id === (selectedShareTipId ?? topTip?.id);
                    return (
                      <TouchableOpacity
                        key={tip.id}
                        onPress={() => {
                          setSelectedShareTipId(tip.id);
                          if (analysis) {
                            shareTipMemoryRef.current[analysis.id] = tip.id;
                          }
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.tipPickerItem,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected
                              ? colors.primary + "14"
                              : colors.background,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.tipPickerDot,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : colors.border,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.tipPickerItemText,
                            {
                              color: isSelected
                                ? colors.foreground
                                : colors.mutedForeground,
                              fontFamily: isSelected
                                ? "Inter_600SemiBold"
                                : "Inter_400Regular",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {tip.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Actions */}
            <TouchableOpacity
              onPress={handleSaveToPhotos}
              activeOpacity={0.7}
              disabled={saving || sharing}
              style={[
                styles.sheetBtn,
                styles.sheetBtnSave,
                lastShareAction === "save"
                  ? { backgroundColor: colors.primary, marginBottom: 10, width: "100%" }
                  : { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 10, width: "100%" },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={lastShareAction === "save" ? "#fff" : colors.foreground} />
              ) : (
                <>
                  <Feather name="download" size={15} color={lastShareAction === "save" ? "#fff" : colors.foreground} />
                  <Text style={[styles.sheetBtnText, { color: lastShareAction === "save" ? "#fff" : colors.foreground }]}>
                    Save to photos
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={handleCancelShare}
                activeOpacity={0.7}
                style={[
                  styles.sheetBtn,
                  styles.sheetBtnCancel,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
              >
                <Text
                  style={[styles.sheetBtnText, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDoShare}
                activeOpacity={0.7}
                disabled={sharing || saving}
                style={[
                  styles.sheetBtn,
                  styles.sheetBtnShare,
                  lastShareAction === "share"
                    ? { backgroundColor: colors.primary }
                    : { borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1 },
                ]}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={lastShareAction === "share" ? "#fff" : colors.foreground} />
                ) : (
                  <>
                    <Feather name="share-2" size={15} color={lastShareAction === "share" ? "#fff" : colors.foreground} />
                    <Text style={[styles.sheetBtnText, { color: lastShareAction === "share" ? "#fff" : colors.foreground }]}>
                      Share
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Animated.View
        style={{ flex: 1, transform: [{ translateX: swipeAnim }] }}
        {...panResponder.panHandlers}
      >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        scrollEventThrottle={16}
        onLayout={(e) => {
          scrollViewHeight.current = e.nativeEvent.layout.height;
        }}
        onScroll={({ nativeEvent }) => {
          if (cardsVisible || scoreGridY.current === null) return;
          const { contentOffset, layoutMeasurement } = nativeEvent;
          if (scoreGridY.current < contentOffset.y + layoutMeasurement.height) {
            setCardsVisible(true);
          }
        }}
      >
        {/* ── Section 1: Quick Summary ── */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Quick Summary" icon="zap" accentColor={colors.primary} />
        </View>

        {/* ── Hero card ── */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslate }],
              overflow: "hidden",
            },
          ]}
        >
          {/* Thumbnail banner — shown when a pose-frame thumbnail is available */}
          {!!analysis.thumbnailUrl && (
            <Image
              source={{ uri: analysis.thumbnailUrl }}
              style={styles.heroThumbnail}
              contentFit="cover"
              transition={200}
            />
          )}

          {/* Title + meta */}
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {analysis.title}
          </Text>
          <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
            {analysis.duration ? `${analysis.duration}s · ` : ""}
            {formatDate(analysis.uploadedAt)}
          </Text>

          {/* Score ring + stats */}
          <View style={styles.heroScoreRow}>
            <View style={styles.ringWrap}>
              <ScoreRing
                score={overallScore}
                size={100}
                strokeWidth={8}
                color={overallBand.color}
                label="OVERALL"
                animate
              />
            </View>

            <View style={styles.heroStats}>
              {/* Best / worst */}
              <View style={[styles.statChip, { backgroundColor: colors.success + "12", borderColor: colors.success + "33" }]}>
                <Feather name="trending-up" size={11} color={colors.success} />
                <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>Best</Text>
                <Text style={[styles.statChipValue, { color: colors.success }]}>
                  {bestMetric.key.charAt(0).toUpperCase() + bestMetric.key.slice(1)} · {Math.round(bestMetric.score)}
                </Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: colors.warning + "12", borderColor: colors.warning + "33" }]}>
                <Feather name="arrow-up-circle" size={11} color={colors.warning} />
                <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>Improve</Text>
                <Text style={[styles.statChipValue, { color: colors.warning }]}>
                  {worstMetric.key.charAt(0).toUpperCase() + worstMetric.key.slice(1)} · {Math.round(worstMetric.score)}
                </Text>
              </View>

              {/* AI summary snippet */}
              {summaryText && (
                <View style={[styles.summaryBox, { backgroundColor: colors.primary + "0a", borderColor: colors.primary + "22" }]}>
                  <Feather name="message-circle" size={11} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={[styles.summaryText, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {summaryText}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Score guide toggle */}
          <TouchableOpacity
            onPress={() => setShowGuide((v) => !v)}
            style={styles.guideToggle}
            activeOpacity={0.7}
          >
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[styles.guideToggleText, { color: colors.mutedForeground }]}>
              What do these scores mean?
            </Text>
            <Feather
              name={showGuide ? "chevron-up" : "chevron-down"}
              size={12}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>

          {showGuide && (
            <View style={[styles.guideBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.guideBoxLabel, { color: colors.mutedForeground }]}>
                Score bands
              </Text>
              {[
                { label: "Strong", color: "#22c55e", range: "80–100", note: "Keep it up" },
                { label: "On Track", color: "#6c63ff", range: "65–79", note: "Room to grow" },
                { label: "Focus Here", color: "#f59e0b", range: "0–64", note: "Prioritise this" },
              ].map((b) => (
                <View key={b.label} style={styles.guideBandRow}>
                  <View style={[styles.guideDot, { backgroundColor: b.color }]} />
                  <Text style={[styles.guideBandLabel, { color: b.color }]}>
                    {b.label}
                  </Text>
                  <Text style={[styles.guideBandRange, { color: colors.mutedForeground }]}>
                    {b.range} — {b.note}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* CTA buttons */}
          <View style={styles.ctaRow}>
            <ScaleButton
              onPress={() =>
                router.push(`/analysis/person-select/${id}` as any)
              }
              style={[
                styles.ctaBtn,
                {
                  backgroundColor: colors.primary + "18",
                  borderColor: colors.primary + "55",
                },
              ]}
            >
              <Feather name="user" size={15} color={colors.primary} />
              <Text style={[styles.ctaBtnText, { color: colors.primary }]}>
                Skeleton
              </Text>
            </ScaleButton>

            <ScaleButton
              onPress={handleAskCoach}
              style={[
                styles.ctaBtn,
                {
                  backgroundColor: colors.success + "18",
                  borderColor: colors.success + "55",
                },
              ]}
            >
              <Feather name="message-circle" size={15} color={colors.success} />
              <Text style={[styles.ctaBtnText, { color: colors.success }]}>
                Ask Coach
              </Text>
            </ScaleButton>
          </View>
        </Animated.View>

        {/* ── Score grid (2 × 3) ── */}
        <View
          style={styles.sectionWrap}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            scoreGridY.current = y;
            // Auto-trigger if the grid is already within the initial viewport
            // (scroll position = 0). This fires on every navigation so newly
            // mounted sessions don't get stuck waiting for a scroll event that
            // will never come when the grid is already on screen.
            if (!cardsVisible && scrollViewHeight.current > 0 && y < scrollViewHeight.current) {
              setCardsVisible(true);
            }
          }}
        >
          <SectionHeader
            title="Your Scores"
            icon="bar-chart-2"
            accentColor={colors.primary}
          />
          <View style={styles.scoreGrid}>
            {SCORE_KEYS.map((key, i) => (
              <View key={key} style={styles.scoreGridCell}>
                <ScoreCard
                  label={key}
                  score={scoreForKey(analysis, key)}
                  icon={SCORE_META[key].icon}
                  desc={SCORE_META[key].desc}
                  delay={i * 60}
                  animate={cardAnimated[i]}
                />
              </View>
            ))}
          </View>
        </View>

        {/* ── Section 3: Biggest Win ── */}
        {(analysis.strengths ?? []).length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Your Biggest Win" icon="check-circle" accentColor={colors.success} />
            <View style={[styles.infoCard, { backgroundColor: colors.success + "0e", borderColor: colors.success + "33" }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Feather name="trending-up" size={15} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 22 }}>
                    {formatBiomechanicsText((analysis.strengths ?? [])[0] ?? "")}
                  </Text>
                  {(analysis.strengths ?? []).slice(1).map((s, i) => (
                    <Text key={i} style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 19, marginTop: 5 }}>
                      • {formatBiomechanicsText(s)}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Section 4: Biggest Fix ── */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Biggest Fix" icon="alert-circle" accentColor={colors.warning} />
          <View style={[styles.infoCard, { backgroundColor: colors.warning + "0e", borderColor: colors.warning + "33" }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.warning + "22", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Feather name="arrow-up-circle" size={15} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                {(analysis.improvements ?? []).length > 0 ? (
                  <>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 22 }}>
                      {formatBiomechanicsText((analysis.improvements ?? [])[0] ?? "")}
                    </Text>
                    {(analysis.improvements ?? []).slice(1, 3).map((imp, i) => (
                      <Text key={i} style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 19, marginTop: 5 }}>
                        • {formatBiomechanicsText(imp)}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 22 }}>
                    Your {worstMetric.key} score of {Math.round(worstMetric.score)}/100 is your top focus area.
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── Section 5: Why It Matters ── */}
        {(topTip?.whyItMatters || topTip?.description) && (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Why It Matters" icon="info" accentColor={colors.primary} />
            <View style={[styles.infoCard, { backgroundColor: colors.primary + "0a", borderColor: colors.primary + "28" }]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Feather name="message-circle" size={15} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 21 }}>
                  {formatBiomechanicsText(topTip.whyItMatters ?? topTip.description)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Section 6: Try This Drill ── */}
        {firstDrill && (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Try This Drill" icon="activity" accentColor={colors.success} />
            <View style={[styles.infoCard, { backgroundColor: colors.success + "0e", borderColor: colors.success + "33" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="activity" size={15} color={colors.success} />
                </View>
                <Text style={{ flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{firstDrill.name}</Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.success, marginBottom: 4 }}>
                {firstDrill.sets} · {firstDrill.reps}
              </Text>
              {firstDrill.cue ? (
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 19, fontStyle: "italic" }}>
                  "{firstDrill.cue}"
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Section 7: Next Workout Goal ── */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Next Workout Goal" icon="target" accentColor="#f59e0b" />
          <NextFocusCard
            focusCue={`Focus on your ${worstMetric.key} — ${SCORE_META[worstMetric.key].desc.toLowerCase()}`}
            drill={firstDrill}
            goal={`Raise your ${worstMetric.key} score from ${Math.round(worstMetric.score)} to ${Math.min(100, Math.round(worstMetric.score) + 10)} next session`}
          />
        </View>

        {/* ── All coaching tips ── */}
        {sortedTips.length > 0 && (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Coaching Tips"
              icon="zap"
              accentColor={colors.primary}
              subtitle={`${sortedTips.length} tip${sortedTips.length !== 1 ? "s" : ""} from your session`}
            />
            {sortedTips.map((tip, idx) => {
              const cfg = SEVERITY_CONFIG[tip.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
              const expanded = expandedTip === null ? idx === 0 : expandedTip === tip.id;
              const whyText = tip.whyItMatters ?? "";
              return (
                <TouchableOpacity
                  key={tip.id}
                  style={[styles.tipCard, { backgroundColor: colors.card, borderColor: cfg.color + "44" }]}
                  activeOpacity={0.85}
                  onPress={() => setExpanded(expanded ? `__none_${tip.id}` : tip.id)}
                >
                  <View style={styles.tipHeader}>
                    <View style={[styles.tipIconWrap, { backgroundColor: cfg.color + "18" }]}>
                      <Feather name={cfg.icon} size={14} color={cfg.color} />
                    </View>
                    <View style={styles.tipTitleBlock}>
                      <Text style={[styles.tipTitle, { color: colors.foreground }]}>{tip.title}</Text>
                      <View style={styles.tipBadgeRow}>
                        <View style={[styles.severityBadge, { backgroundColor: cfg.color + "18" }]}>
                          <Text style={[styles.severityBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={[styles.tipCategory, { color: colors.mutedForeground }]}>{tip.category}</Text>
                      </View>
                    </View>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                  </View>
                  {expanded && (
                    <View style={styles.tipBody}>
                      {tip.videoObservation && (
                        <View style={[styles.observationBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
                          <Feather name="eye" size={13} color={colors.primary} style={{ marginTop: 1 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.observationLabel, { color: colors.primary }]}>Observed in your video</Text>
                            <Text style={[styles.observationText, { color: colors.foreground }]}>{formatBiomechanicsText(tip.videoObservation)}</Text>
                          </View>
                        </View>
                      )}
                      {whyText.length > 0 && (
                        <View style={[styles.whyBox, { backgroundColor: cfg.color + "0a", borderLeftColor: cfg.color }]}>
                          <Text style={[styles.whyLabel, { color: cfg.color }]}>WHY IT MATTERS</Text>
                          <Text style={[styles.whyText, { color: colors.foreground }]}>{formatBiomechanicsText(whyText)}</Text>
                        </View>
                      )}
                      <Text style={[styles.tipDesc, { color: colors.mutedForeground }]}>{formatBiomechanicsText(tip.description)}</Text>
                      {(tip.joints?.length ?? 0) > 0 && (
                        <View style={styles.chipRow}>
                          {tip.joints!.map((j) => (
                            <TouchableOpacity
                              key={j}
                              style={[styles.chip, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "12" }]}
                              onPress={() => router.push({ pathname: "/analysis/skeleton/[id]", params: { id: id!, highlightJoint: j } } as any)}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.chipDot, { backgroundColor: cfg.color }]} />
                              <Text style={[styles.chipText, { color: cfg.color }]}>{JOINT_LABEL[j] ?? j}</Text>
                              <Feather name="crosshair" size={9} color={cfg.color} style={{ opacity: 0.6 }} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {tip.drill && (
                        <View style={[styles.drillBox, { backgroundColor: colors.success + "0e", borderColor: colors.success + "33" }]}>
                          <View style={styles.drillHeaderRow}>
                            <Feather name="activity" size={12} color={colors.success} />
                            <Text style={[styles.drillLabel, { color: colors.success }]}>HOW TO FIX IT — DRILL</Text>
                          </View>
                          <Text style={[styles.drillName, { color: colors.foreground }]}>
                            {typeof tip.drill === "string" ? tip.drill : tip.drill.name}
                          </Text>
                          {typeof tip.drill !== "string" && (
                            <Text style={[styles.drillMeta, { color: colors.mutedForeground }]}>
                              {tip.drill.sets} · {tip.drill.reps}{tip.drill.cue ? ` — ${tip.drill.cue}` : ""}
                            </Text>
                          )}
                        </View>
                      )}
                      {tip.source && (
                        <View style={[styles.sourceRow, { borderTopColor: colors.border }]}>
                          <Feather name="book-open" size={10} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                          <Text style={[styles.sourceText, { color: colors.mutedForeground }]}>{tip.source}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}


        {/* ── Joint Health (Injury Risks) ── */}
        <View style={styles.sectionWrap}>
          <SectionHeader title="Joint Health" icon="shield" accentColor={colors.destructive} subtitle="Injury risk levels from this session" />
          {risks.length === 0 ? (
            <View style={styles.noRiskWrap}>
              <View style={[styles.noRiskIcon, { backgroundColor: colors.success + "18" }]}>
                <Feather name="shield" size={24} color={colors.success} />
              </View>
              <Text style={[styles.noRiskHeading, { color: colors.foreground }]}>All clear</Text>
              <Text style={[styles.noRiskSub, { color: colors.mutedForeground }]}>No significant injury risks detected. Keep moving well!</Text>
            </View>
          ) : (
            risks.map((risk, idx) => {
              const clr = risk.riskPercent >= 50 ? colors.destructive : risk.riskPercent >= 30 ? colors.warning : colors.success;
              const rl = getRiskLabel(risk.riskPercent);
              return (
                <View key={risk.id} style={[styles.riskCard, { backgroundColor: colors.card, borderColor: clr + "33" }]}>
                  <View style={styles.riskHeaderRow}>
                    <Text style={[styles.riskJoint, { color: colors.foreground }]}>{JOINT_LABEL[risk.joint] ?? risk.joint}</Text>
                    <View style={styles.riskRightCol}>
                      <View style={[styles.riskBadge, { backgroundColor: clr + "18" }]}>
                        <Text style={[styles.riskBadgeText, { color: clr }]}>{rl.label}</Text>
                      </View>
                      <Text style={[styles.riskPct, { color: clr }]}>{risk.riskPercent}%</Text>
                    </View>
                  </View>
                  <AnimatedRiskBar pct={risk.riskPercent} color={clr} delay={idx * 80} />
                  <View style={[styles.whatThisMeansBox, { backgroundColor: clr + "08", borderColor: clr + "22" }]}>
                    <Text style={[styles.whatThisMeansLabel, { color: clr }]}>WHAT THIS MEANS</Text>
                    <Text style={[styles.riskDesc, { color: colors.foreground }]}>{formatBiomechanicsText(risk.description)}</Text>
                  </View>
                  <Text style={[styles.riskPrev, { color: colors.mutedForeground }]}>
                    <Text style={[styles.prevLabel, { color: colors.primary }]}>Prevention: </Text>
                    {risk.prevention}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── Session Notes ── */}
        <View style={[styles.sectionWrap, { marginTop: 8, marginBottom: 32 }]}>
          <View style={styles.noteHeaderRow}>
            <Feather name="edit-3" size={15} color={colors.mutedForeground} />
            <Text style={[styles.noteTitle, { color: colors.foreground }]}>
              Session Notes
            </Text>
          </View>
          <TextInput
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            value={note}
            onChangeText={setNote}
            onBlur={() => id && AsyncStorage.setItem(`note_${id}`, note)}
            placeholder="Add personal notes — how you felt, what to focus on next time, any context about the session…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          {note.length > 0 && (
            <Text style={[styles.noteFooter, { color: colors.mutedForeground }]}>
              {note.length} chars · saved locally
            </Text>
          )}
        </View>
      </ScrollView>
      </Animated.View>

      {/* ── Swipe hint pill ── */}
      <Animated.View
        style={[
          styles.swipeHint,
          {
            backgroundColor: colors.foreground + "CC",
            bottom: bottomPad + 72,
            opacity: swipeHintOpacity,
          },
        ]}
        pointerEvents="none"
      >
        <Feather name="chevron-left" size={14} color={colors.background} />
        <Text style={[styles.swipeHintText, { color: colors.background }]}>
          Swipe to navigate
        </Text>
        <Feather name="chevron-right" size={14} color={colors.background} />
      </Animated.View>

      {/* ── Goal reached toast ── */}
      {goalToast && (
        <Animated.View
          style={[
            styles.goalToast,
            {
              backgroundColor: colors.card,
              borderColor: "#f59e0b55",
              bottom: bottomPad + 16,
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslate }],
            },
          ]}
          pointerEvents="box-none"
        >
          <Text style={styles.goalToastEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.goalToastTitle, { color: colors.foreground }]}>
              Weekly goal reached!
            </Text>
            <Text style={[styles.goalToastSub, { color: colors.mutedForeground }]}>
              {goalToast.count} of {goalToast.goal} sessions done this week
            </Text>
          </View>
          <TouchableOpacity
            onPress={dismissToast}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Nav
  navBar: {
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
  },
  navBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  navCenter: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionNavBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  sportBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  sportBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  navCenterBadgeCol: { alignItems: "center", gap: 2 },
  sessionCounter: { fontSize: 10, fontFamily: "Inter_400Regular" },

  // Hero
  heroCard: {
    margin: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
  },
  heroThumbnail: {
    height: 160,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 14,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
  },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  heroMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginTop: 18,
  },
  ringWrap: { alignItems: "center" },
  heroStats: { flex: 1, gap: 8 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statChipValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  summaryText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    flex: 1,
  },
  guideToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
    alignSelf: "flex-end",
  },
  guideToggleText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  guideBox: { borderRadius: 12, padding: 14, marginTop: 10, gap: 8 },
  guideBoxLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  guideBandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  guideDot: { width: 8, height: 8, borderRadius: 4 },
  guideBandLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 74 },
  guideBandRange: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  ctaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  ctaBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Score grid
  sectionWrap: { paddingHorizontal: 16, marginBottom: 16 },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  scoreGridCell: { width: "48%", flexShrink: 1 },

  // Info card (used by Biggest Win, Biggest Fix, Why It Matters, Try This Drill)
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 2,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 8,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Highlights
  sectionGap: { height: 16 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  drillHighlight: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  drillHighlightName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  drillHighlightMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  drillHighlightCue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 18,
  },

  // Tips
  tipCard: {
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitleBlock: { flex: 1 },
  tipTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tipBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  severityBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  severityBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tipCategory: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tipBody: { paddingHorizontal: 14, paddingBottom: 14 },
  observationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  observationLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  observationText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  whyBox: {
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    marginBottom: 10,
  },
  whyLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  whyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tipDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  drillBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  drillHeaderRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  drillLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  drillName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  drillMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sourceText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    flex: 1,
    fontStyle: "italic",
    lineHeight: 14,
  },

  // Risks
  noRiskWrap: { alignItems: "center", paddingVertical: 32, gap: 10 },
  noRiskIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  noRiskHeading: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  noRiskSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  riskCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  riskHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riskJoint: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  riskRightCol: { alignItems: "flex-end", gap: 4 },
  riskBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  riskBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  riskPct: { fontSize: 20, fontFamily: "Inter_700Bold" },
  whatThisMeansBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  whatThisMeansLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  riskDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  riskPrev: { fontSize: 12, fontFamily: "Inter_400Regular" },
  prevLabel: { fontFamily: "Inter_500Medium" },

  // Notes
  noteHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  noteTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    minHeight: 110,
  },
  noteFooter: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    textAlign: "right",
  },

  // Swipe hint
  swipeHint: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  swipeHintText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },

  // Goal reached toast
  goalToast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  goalToastEmoji: { fontSize: 20 },
  goalToastTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  goalToastSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Share preview modal
  shareModalBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  shareModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
    textAlign: "center",
  },
  shareCardPreviewWrap: {
    alignSelf: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
    borderRadius: 20,
    overflow: "hidden",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  sheetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    paddingVertical: 14,
  },
  sheetBtnCancel: {
    borderWidth: 1,
  },
  sheetBtnSave: {
    borderWidth: 1,
  },
  sheetBtnShare: {},
  sheetBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  // Scheme picker
  schemePicker: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  schemePill: {
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 8,
  },
  miniCard: {
    width: 72,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  miniCardBar: {
    height: 22,
    width: "100%",
    opacity: 0.75,
  },
  miniCardLines: {
    padding: 8,
  },
  miniCardLine: {
    height: 5,
    borderRadius: 3,
  },
  schemePillLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  schemePillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Tip picker
  tipPickerWrap: {
    width: "100%",
    marginBottom: 20,
  },
  tipPickerLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  tipPickerList: {
    maxHeight: 160,
  },
  tipPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  tipPickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  tipPickerItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
