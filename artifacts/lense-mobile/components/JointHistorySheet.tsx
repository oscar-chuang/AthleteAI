import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Svg, { Line, Path, Polyline, Circle, Text as SvgText, Rect, G } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import type { JointDataPoint } from "@/lib/api";

const JOINT_HISTORY_DISPLAY: Record<string, string> = {
  leftKnee: "Left Knee", rightKnee: "Right Knee",
  leftHip: "Left Hip", rightHip: "Right Hip",
  leftElbow: "Left Elbow", rightElbow: "Right Elbow",
};
const RISK_COLOR_MAP = ["#22c55e", "#f59e0b", "#ef4444"] as const;
const RISK_LABEL_MAP = ["Safe", "Caution", "High Risk"] as const;

const CHART_PAD_L = 36, CHART_PAD_R = 8, CHART_PAD_T = 10, CHART_PAD_B = 36;
const CHART_H_INNER = 140;

export default function JointHistorySheet({
  joint,
  data,
  currentAnalysisId,
  onClose,
}: {
  joint: string;
  data: JointDataPoint[];
  currentAnalysisId: string;
  onClose: () => void;
}) {
  const { width: sw } = Dimensions.get("window");
  const chartW = sw - 48 - CHART_PAD_L - CHART_PAD_R;
  const label = JOINT_HISTORY_DISPLAY[joint] ?? joint;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const angles = data.map((d) => d.angle);
  const minAngle = Math.max(0, Math.min(...angles) - 8);
  const maxAngle = Math.max(...angles) + 8;
  const range = maxAngle - minAngle || 1;

  function toX(i: number) {
    if (data.length === 1) return CHART_PAD_L + chartW / 2;
    return CHART_PAD_L + (i / (data.length - 1)) * chartW;
  }
  function toY(angle: number) {
    return CHART_PAD_T + CHART_H_INNER - ((angle - minAngle) / range) * CHART_H_INNER;
  }

  const polyPts = data.length > 1
    ? data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.angle).toFixed(1)}`).join(" ")
    : "";

  const areaPath = data.length > 1
    ? [
        `M ${toX(0).toFixed(1)} ${toY(data[0]!.angle).toFixed(1)}`,
        ...data.slice(1).map((d, i) => `L ${toX(i + 1).toFixed(1)} ${toY(d.angle).toFixed(1)}`),
        `L ${toX(data.length - 1).toFixed(1)} ${(CHART_PAD_T + CHART_H_INNER).toFixed(1)}`,
        `L ${CHART_PAD_L.toFixed(1)} ${(CHART_PAD_T + CHART_H_INNER).toFixed(1)}`,
        "Z",
      ].join(" ")
    : null;

  const yTicks = [minAngle, minAngle + range * 0.5, maxAngle];
  const totalSvgH = CHART_PAD_T + CHART_H_INNER + CHART_PAD_B;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const last = data[data.length - 1];
  const first = data[0];
  const deltaDeg = last && first ? Math.round(last.angle - first.angle) : 0;
  const latestRisk = last?.risk ?? 0;
  const riskColor = RISK_COLOR_MAP[latestRisk] ?? "#6c63ff";
  const riskLabel = RISK_LABEL_MAP[latestRisk] ?? "";

  const currentIdx = data.findIndex((d) => d.analysisId === currentAnalysisId);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.60)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: "#0e0e1a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: "#2a2a40",
            paddingHorizontal: 24,
            paddingBottom: 40,
            paddingTop: 16,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#3a3a5c", alignSelf: "center", marginBottom: 18 }} />

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#f1f1fa" }}>{label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: riskColor }}>
                  {last ? `${Math.round(last.angle)}°` : "—"}
                </Text>
                <View style={{ backgroundColor: riskColor + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: riskColor }}>{riskLabel}</Text>
                </View>
                {data.length >= 2 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather
                      name={deltaDeg >= 0 ? "arrow-up-right" : "arrow-down-right"}
                      size={12}
                      color={deltaDeg >= 0 ? "#22c55e" : "#f59e0b"}
                    />
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: deltaDeg >= 0 ? "#22c55e" : "#f59e0b" }}>
                      {deltaDeg >= 0 ? "+" : ""}{deltaDeg}° over {data.length} scan{data.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: 4 }}>
              <Feather name="x" size={20} color="#8888aa" />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
            {([0, 1, 2] as const).map((risk) => (
              <View key={risk} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RISK_COLOR_MAP[risk] }} />
                <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#8888aa" }}>{RISK_LABEL_MAP[risk]}</Text>
              </View>
            ))}
            {currentIdx >= 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" as any }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#6c63ff", borderWidth: 2, borderColor: "#0e0e1a" }} />
                <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: "#6c63ff" }}>This session</Text>
              </View>
            )}
          </View>

          {/* Chart */}
          {data.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ color: "#8888aa", fontFamily: "Inter_400Regular", fontSize: 13 }}>No history yet</Text>
            </View>
          ) : (
            <Svg width={sw - 48} height={totalSvgH + 72} style={{ overflow: "visible" }}>
              {/* Transparent dismiss area — clears selection when tapping chart background */}
              <Rect
                x={0} y={0}
                width={sw - 48} height={totalSvgH + 72}
                fill="transparent"
                onPress={() => setSelectedIndex(null)}
              />

              {/* Y-axis grid + labels */}
              {yTicks.map((tick, ti) => {
                const y = toY(tick);
                return (
                  <React.Fragment key={ti}>
                    <Line
                      x1={CHART_PAD_L} y1={y}
                      x2={CHART_PAD_L + chartW} y2={y}
                      stroke="#2a2a40" strokeWidth={1}
                    />
                    <SvgText
                      x={CHART_PAD_L - 4} y={y + 3}
                      fontSize={8} fill="#55556e"
                      fontFamily="Inter_400Regular" textAnchor="end"
                    >
                      {Math.round(tick)}°
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Area fill */}
              {areaPath && <Path d={areaPath} fill="#6c63ff18" />}

              {/* Line */}
              {data.length > 1 && (
                <Polyline
                  points={polyPts} fill="none"
                  stroke="#6c63ff" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              )}

              {/* Data points — risk-coloured; tappable; selected point gets highlight ring */}
              {data.map((d, i) => {
                const dotColor = RISK_COLOR_MAP[d.risk] ?? "#6c63ff";
                const isCurrent = d.analysisId === currentAnalysisId;
                const isSelected = selectedIndex === i;
                const cx = toX(i);
                const cy = toY(d.angle);
                const dotR = isSelected ? 8 : isCurrent ? 6 : 4;
                return (
                  <React.Fragment key={i}>
                    {/* Outer glow ring for current session */}
                    {isCurrent && !isSelected && (
                      <Circle cx={cx} cy={cy} r={10} fill="#6c63ff22" />
                    )}
                    {/* Selection highlight ring */}
                    {isSelected && (
                      <Circle cx={cx} cy={cy} r={14} fill={dotColor + "30"} stroke={dotColor} strokeWidth={1.5} />
                    )}
                    {/* Hit-target circle (transparent, larger) */}
                    <Circle
                      cx={cx} cy={cy} r={18}
                      fill="transparent"
                      onPress={() => setSelectedIndex(isSelected ? null : i)}
                    />
                    {/* Visible dot */}
                    <Circle
                      cx={cx} cy={cy}
                      r={dotR}
                      fill={dotColor}
                      stroke={isCurrent || isSelected ? "#0e0e1a" : "none"}
                      strokeWidth={isCurrent || isSelected ? 2 : 0}
                    />
                  </React.Fragment>
                );
              })}

              {/* X-axis date labels */}
              {(() => {
                const labels: { i: number; text: string }[] = [];
                if (data.length === 1) {
                  labels.push({ i: 0, text: formatDate(data[0]!.date) });
                } else if (data.length === 2) {
                  labels.push({ i: 0, text: formatDate(data[0]!.date) });
                  labels.push({ i: 1, text: formatDate(data[1]!.date) });
                } else {
                  labels.push({ i: 0, text: formatDate(data[0]!.date) });
                  labels.push({ i: data.length - 1, text: formatDate(data[data.length - 1]!.date) });
                }
                return labels.map(({ i, text }) => (
                  <SvgText
                    key={i}
                    x={toX(i)} y={CHART_PAD_T + CHART_H_INNER + 20}
                    fontSize={9} fill="#55556e"
                    fontFamily="Inter_400Regular"
                    textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                  >
                    {text}
                  </SvgText>
                ));
              })()}

              {/* Tooltip — rendered last so it sits on top of everything */}
              {selectedIndex !== null && (() => {
                const sel = data[selectedIndex]!;
                const cx = toX(selectedIndex);
                const cy = toY(sel.angle);
                const dotColor = RISK_COLOR_MAP[sel.risk] ?? "#6c63ff";
                const rLabel = RISK_LABEL_MAP[sel.risk] ?? "";
                const tooltipW = 130;
                const tooltipH = 68;
                const arrowH = 7;
                const cornerR = 8;
                const svgW = sw - 48;
                const rawTx = cx - tooltipW / 2;
                const tx = Math.max(4, Math.min(rawTx, svgW - tooltipW - 4));
                const placeAbove = cy - CHART_PAD_T > tooltipH + arrowH + 10;
                const ty = placeAbove
                  ? cy - tooltipH - arrowH - 12
                  : cy + 14 + arrowH;
                const arrowX = cx - tx;
                const clampedArrowX = Math.max(cornerR + 4, Math.min(arrowX, tooltipW - cornerR - 4));
                return (
                  <G key="tooltip">
                    {/* Shadow rect */}
                    <Rect
                      x={tx + 2} y={ty + 2}
                      width={tooltipW} height={tooltipH}
                      rx={cornerR} ry={cornerR}
                      fill="rgba(0,0,0,0.35)"
                    />
                    {/* Background */}
                    <Rect
                      x={tx} y={ty}
                      width={tooltipW} height={tooltipH}
                      rx={cornerR} ry={cornerR}
                      fill="#1a1a2e"
                      stroke={dotColor}
                      strokeWidth={1.2}
                    />
                    {/* Arrow pointing to dot */}
                    {placeAbove ? (
                      <Path
                        d={`M ${tx + clampedArrowX - 6} ${ty + tooltipH} L ${tx + clampedArrowX} ${ty + tooltipH + arrowH} L ${tx + clampedArrowX + 6} ${ty + tooltipH} Z`}
                        fill="#1a1a2e"
                        stroke={dotColor}
                        strokeWidth={1.2}
                      />
                    ) : (
                      <Path
                        d={`M ${tx + clampedArrowX - 6} ${ty} L ${tx + clampedArrowX} ${ty - arrowH} L ${tx + clampedArrowX + 6} ${ty} Z`}
                        fill="#1a1a2e"
                        stroke={dotColor}
                        strokeWidth={1.2}
                      />
                    )}
                    {/* Angle — large */}
                    <SvgText
                      x={tx + tooltipW / 2} y={ty + 22}
                      fontSize={18} fontFamily="Inter_700Bold"
                      fill={dotColor} textAnchor="middle"
                    >
                      {Math.round(sel.angle)}°
                    </SvgText>
                    {/* Risk label */}
                    <SvgText
                      x={tx + tooltipW / 2} y={ty + 38}
                      fontSize={10} fontFamily="Inter_600SemiBold"
                      fill={dotColor} textAnchor="middle"
                    >
                      {rLabel}
                    </SvgText>
                    {/* Date · sport */}
                    <SvgText
                      x={tx + tooltipW / 2} y={ty + 55}
                      fontSize={9} fontFamily="Inter_400Regular"
                      fill="#8888aa" textAnchor="middle"
                    >
                      {formatDate(sel.date)} · {sel.sport}
                    </SvgText>
                  </G>
                );
              })()}
            </Svg>
          )}

          <Text style={{ fontSize: 11, color: "#55556e", fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" }}>
            {data.length} scan{data.length === 1 ? "" : "s"} · angle history
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
