import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Line,
  Circle,
  Path,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
  G,
  Ellipse,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { MOCK_ATHLETE } from "@/lib/athleteData";

// ── Sport-specific skeleton poses (side-view, SVG coords 0-320 x 0-380) ──
const POSES: Record<string, {
  joints: Record<string, [number, number]>;
  bones: [string, string][];
  label: string;
}> = {
  weightlifting: {
    label: "Deadlift Position",
    joints: {
      head:   [148, 48],
      neck:   [152, 74],
      rShoulder: [134, 100],
      lShoulder: [170, 102],
      rElbow: [110, 142],
      lElbow: [148, 148],
      rWrist: [100, 192],
      lWrist: [138, 198],
      spine1: [158, 110],
      spine2: [172, 148],
      spine3: [186, 180],
      rHip:   [196, 208],
      lHip:   [204, 210],
      rKnee:  [204, 272],
      lKnee:  [214, 274],
      rAnkle: [200, 335],
      lAnkle: [210, 337],
    },
    bones: [
      ["head", "neck"],
      ["neck", "spine1"],
      ["spine1", "rShoulder"],
      ["spine1", "lShoulder"],
      ["rShoulder", "rElbow"],
      ["rElbow", "rWrist"],
      ["lShoulder", "lElbow"],
      ["lElbow", "lWrist"],
      ["spine1", "spine2"],
      ["spine2", "spine3"],
      ["spine3", "rHip"],
      ["spine3", "lHip"],
      ["rHip", "rKnee"],
      ["rKnee", "rAnkle"],
      ["lHip", "lKnee"],
      ["lKnee", "lAnkle"],
    ],
  },
  basketball: {
    label: "Jump Shot",
    joints: {
      head:   [160, 35],
      neck:   [160, 62],
      rShoulder: [130, 92],
      lShoulder: [190, 92],
      rElbow: [110, 140],
      lElbow: [210, 118],
      rWrist: [128, 188],
      lWrist: [230, 80],
      rHip:   [148, 185],
      lHip:   [172, 185],
      rKnee:  [134, 248],
      lKnee:  [178, 244],
      rAnkle: [128, 318],
      lAnkle: [185, 316],
    },
    bones: [
      ["head", "neck"],
      ["neck", "rShoulder"],
      ["neck", "lShoulder"],
      ["rShoulder", "rElbow"],
      ["rElbow", "rWrist"],
      ["lShoulder", "lElbow"],
      ["lElbow", "lWrist"],
      ["rShoulder", "rHip"],
      ["lShoulder", "lHip"],
      ["rHip", "lHip"],
      ["rHip", "rKnee"],
      ["rKnee", "rAnkle"],
      ["lHip", "lKnee"],
      ["lKnee", "lAnkle"],
    ],
  },
  running: {
    label: "Sprint Drive Phase",
    joints: {
      head:   [165, 40],
      neck:   [162, 66],
      rShoulder: [140, 94],
      lShoulder: [182, 94],
      rElbow: [110, 128],
      lElbow: [210, 118],
      rWrist: [90, 160],
      lWrist: [230, 88],
      rHip:   [155, 185],
      lHip:   [175, 185],
      rKnee:  [170, 260],
      lKnee:  [145, 232],
      rAnkle: [188, 330],
      lAnkle: [118, 295],
    },
    bones: [
      ["head", "neck"],
      ["neck", "rShoulder"],
      ["neck", "lShoulder"],
      ["rShoulder", "rElbow"],
      ["rElbow", "rWrist"],
      ["lShoulder", "lElbow"],
      ["lElbow", "lWrist"],
      ["rShoulder", "rHip"],
      ["lShoulder", "lHip"],
      ["rHip", "lHip"],
      ["rHip", "rKnee"],
      ["rKnee", "rAnkle"],
      ["lHip", "lKnee"],
      ["lKnee", "lAnkle"],
    ],
  },
  golf: {
    label: "Impact Position",
    joints: {
      head:   [152, 50],
      neck:   [156, 76],
      rShoulder: [132, 108],
      lShoulder: [180, 102],
      rElbow: [112, 152],
      lElbow: [202, 148],
      rWrist: [140, 192],
      lWrist: [196, 192],
      rHip:   [165, 210],
      lHip:   [182, 208],
      rKnee:  [162, 272],
      lKnee:  [186, 268],
      rAnkle: [156, 338],
      lAnkle: [192, 334],
    },
    bones: [
      ["head", "neck"],
      ["neck", "rShoulder"],
      ["neck", "lShoulder"],
      ["rShoulder", "rElbow"],
      ["rElbow", "rWrist"],
      ["lShoulder", "lElbow"],
      ["lElbow", "lWrist"],
      ["rShoulder", "rHip"],
      ["lShoulder", "lHip"],
      ["rHip", "lHip"],
      ["rHip", "rKnee"],
      ["rKnee", "rAnkle"],
      ["lHip", "lKnee"],
      ["lKnee", "lAnkle"],
    ],
  },
};

const DEFAULT_POSE = POSES.basketball;

function getRiskJoints(analysisId: string): Record<string, number> {
  const analysis = MOCK_ATHLETE.analyses.find((a) => a.id === analysisId);
  if (!analysis) return {};
  const map: Record<string, number> = {};
  analysis.injuryRisks.forEach((r) => {
    const j = r.joint.toLowerCase();
    if (j.includes("lumbar") || j.includes("back") || j.includes("spine")) {
      map["spine2"] = r.risk;
      map["spine3"] = r.risk;
    }
    if (j.includes("knee")) {
      if (j.includes("left")) map["lKnee"] = r.risk;
      else if (j.includes("right")) map["rKnee"] = r.risk;
      else { map["lKnee"] = r.risk; map["rKnee"] = r.risk; }
    }
    if (j.includes("hip")) {
      if (j.includes("left")) map["lHip"] = r.risk;
      else { map["rHip"] = r.risk; }
    }
    if (j.includes("shoulder")) {
      if (j.includes("right")) map["rShoulder"] = r.risk;
      else map["lShoulder"] = r.risk;
    }
    if (j.includes("ankle")) {
      if (j.includes("left")) map["lAnkle"] = r.risk;
      else { map["rAnkle"] = r.risk; map["lAnkle"] = r.risk; }
    }
    if (j.includes("wrist")) {
      if (j.includes("right")) map["rWrist"] = r.risk;
      else map["lWrist"] = r.risk;
    }
    if (j.includes("elbow")) {
      map["rElbow"] = r.risk;
    }
  });
  return map;
}

function jointColor(risk: number | undefined): string {
  if (risk === undefined) return "#6c63ff";
  if (risk >= 50) return "#ef4444";
  if (risk >= 25) return "#f59e0b";
  return "#22c55e";
}

function jointGlow(risk: number | undefined): string {
  if (risk === undefined) return "#6c63ff44";
  if (risk >= 50) return "#ef444444";
  if (risk >= 25) return "#f59e0b44";
  return "#22c55e44";
}

const SVG_W = 320;
const SVG_H = 380;

export default function SkeletonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = Dimensions.get("window");
  const isLandscape = width > height;

  const analysis = MOCK_ATHLETE.analyses.find((a) => a.id === id);
  const pose = POSES[analysis?.sport ?? ""] ?? DEFAULT_POSE;
  const riskJoints = getRiskJoints(id ?? "");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const sidePad = Platform.OS === "web" ? 0 : 0;

  const panelWidth = isLandscape ? width * 0.52 : width;
  const svgScale = (panelWidth / SVG_W) * 0.88;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#050508" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: topPad + 8,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#1e1e2e",
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#111118",
      borderWidth: 1,
      borderColor: "#1e1e2e",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#f0f0f8", flex: 1 },
    rotateHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary + "22",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    rotateText: { fontSize: 11, color: colors.primary, fontFamily: "Inter_400Regular" },
    body: {
      flex: 1,
      flexDirection: isLandscape ? "row" : "column",
    },
    skeletonPanel: {
      backgroundColor: "#07070c",
      alignItems: "center",
      justifyContent: "center",
      flex: isLandscape ? 0.55 : 0,
      width: isLandscape ? undefined : "100%",
      height: isLandscape ? undefined : 340,
    },
    infoPanel: {
      flex: isLandscape ? 0.45 : 1,
      padding: 20,
    },
    poseLabel: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 16,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    scoreLabel: {
      fontSize: 12,
      color: "#8888aa",
      fontFamily: "Inter_400Regular",
      width: 90,
      textTransform: "capitalize",
    },
    scoreBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: "#1e1e2e",
      borderRadius: 3,
      marginHorizontal: 10,
    },
    scoreBarFill: { height: 6, borderRadius: 3 },
    scoreNum: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: "#f0f0f8",
      width: 28,
      textAlign: "right",
    },
    divider: {
      height: 1,
      backgroundColor: "#1e1e2e",
      marginVertical: 14,
    },
    riskTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: "#f0f0f8",
      marginBottom: 10,
    },
    riskItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    riskDot: { width: 8, height: 8, borderRadius: 4 },
    riskText: { fontSize: 12, color: "#8888aa", fontFamily: "Inter_400Regular", flex: 1 },
    riskPct: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    legendRow: {
      flexDirection: "row",
      gap: 14,
      marginTop: 16,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, color: "#8888aa", fontFamily: "Inter_400Regular" },
  });

  function getScoreColor(s: number) {
    if (s >= 80) return "#22c55e";
    if (s >= 65) return "#6c63ff";
    return "#f59e0b";
  }

  const scores = analysis?.scores;
  const scoreKeys = ["technique", "power", "balance", "consistency"] as const;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color="#8888aa" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {pose.label} — {analysis?.title ?? "Skeleton"}
        </Text>
        {!isLandscape && (
          <View style={s.rotateHint}>
            <Feather name="rotate-cw" size={11} color="#6c63ff" />
            <Text style={s.rotateText}>Rotate</Text>
          </View>
        )}
      </View>

      <View style={s.body}>
        {/* ── Skeleton SVG panel ── */}
        <View style={s.skeletonPanel}>
          <Svg
            width={SVG_W * svgScale}
            height={SVG_H * svgScale}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          >
            <Defs>
              <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#6c63ff" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#050508" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Background glow */}
            <Ellipse cx={SVG_W / 2} cy={SVG_H / 2} rx={140} ry={175} fill="url(#bgGlow)" />

            {/* Grid lines (subtle) */}
            {[80, 160, 240, 320].map((y) => (
              <Line key={y} x1={0} y1={y} x2={SVG_W} y2={y} stroke="#1e1e2e" strokeWidth={0.5} />
            ))}

            {/* Bones */}
            {pose.bones.map(([a, b], i) => {
              const pa = pose.joints[a];
              const pb = pose.joints[b];
              if (!pa || !pb) return null;
              const riskA = riskJoints[a];
              const riskB = riskJoints[b];
              const maxRisk = Math.max(riskA ?? 0, riskB ?? 0);
              const boneColor = maxRisk >= 50 ? "#ef444488" : maxRisk >= 25 ? "#f59e0b88" : "#6c63ff88";
              return (
                <Line
                  key={i}
                  x1={pa[0]} y1={pa[1]}
                  x2={pb[0]} y2={pb[1]}
                  stroke={boneColor}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Joints */}
            {Object.entries(pose.joints).map(([name, [x, y]]) => {
              const risk = riskJoints[name];
              const color = jointColor(risk);
              const glow = jointGlow(risk);
              const isHead = name === "head";
              const r = isHead ? 14 : 6;
              return (
                <G key={name}>
                  {/* Glow halo */}
                  <Circle cx={x} cy={y} r={r + 6} fill={glow} />
                  {/* Joint dot */}
                  <Circle
                    cx={x} cy={y} r={r}
                    fill="#050508"
                    stroke={color}
                    strokeWidth={isHead ? 2 : 2.5}
                  />
                  {/* High-risk pulse ring */}
                  {risk !== undefined && risk >= 50 && (
                    <Circle cx={x} cy={y} r={r + 12} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" />
                  )}
                  {/* Risk label for significant joints */}
                  {risk !== undefined && risk >= 25 && !isHead && (
                    <SvgText
                      x={x + 10}
                      y={y - 8}
                      fontSize={9}
                      fill={color}
                      fontWeight="600"
                    >
                      {risk}%
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>
        </View>

        {/* ── Info panel ── */}
        <ScrollView style={s.infoPanel} showsVerticalScrollIndicator={false}>
          <Text style={s.poseLabel}>{pose.label}</Text>

          {scores && scoreKeys.map((key) => {
            const val = scores[key];
            const c = getScoreColor(val);
            return (
              <View key={key} style={s.scoreRow}>
                <Text style={s.scoreLabel}>{key}</Text>
                <View style={s.scoreBarBg}>
                  <View style={[s.scoreBarFill, { width: `${val}%` as any, backgroundColor: c }]} />
                </View>
                <Text style={[s.scoreNum, { color: c }]}>{val}</Text>
              </View>
            );
          })}

          <View style={s.divider} />

          {analysis && analysis.injuryRisks.length > 0 && (
            <>
              <Text style={s.riskTitle}>Joint Risk</Text>
              {analysis.injuryRisks.map((r, i) => {
                const c = r.risk >= 50 ? "#ef4444" : r.risk >= 25 ? "#f59e0b" : "#22c55e";
                return (
                  <View key={i} style={s.riskItem}>
                    <View style={[s.riskDot, { backgroundColor: c }]} />
                    <Text style={s.riskText}>{r.joint}</Text>
                    <Text style={[s.riskPct, { color: c }]}>{r.risk}%</Text>
                  </View>
                );
              })}
            </>
          )}

          <View style={s.divider} />

          <View style={s.legendRow}>
            {[
              { color: "#22c55e", label: "Good (<25%)" },
              { color: "#f59e0b", label: "Caution (25-49%)" },
              { color: "#ef4444", label: "High risk (50%+)" },
            ].map((l) => (
              <View key={l.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: l.color }]} />
                <Text style={s.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}
