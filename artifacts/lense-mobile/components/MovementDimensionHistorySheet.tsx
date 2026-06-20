import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  StyleSheet,
} from "react-native";
import { toTitleCase } from "@/utils/formatDisplay";
import Svg, {
  Line,
  Path,
  Polyline,
  Circle,
  Text as SvgText,
} from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { type MovementSummaryDataPoint } from "@/lib/api";

const SCORE_BANDS = [
  { min: 85, label: "Elite" },
  { min: 70, label: "Advanced" },
  { min: 55, label: "Proficient" },
  { min: 40, label: "Developing" },
  { min: 0,  label: "Beginner" },
] as const;

function getScoreBand(score: number): string {
  for (const band of SCORE_BANDS) {
    if (score >= band.min) return band.label;
  }
  return "Beginner";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const CHART_PAD_L = 36,
  CHART_PAD_R = 8,
  CHART_PAD_T = 10,
  CHART_PAD_B = 36;
const CHART_H_INNER = 140;

export default function MovementDimensionHistorySheet({
  dimensionKey,
  label,
  color,
  data,
  onClose,
}: {
  dimensionKey: keyof MovementSummaryDataPoint;
  label: string;
  color: string;
  data: MovementSummaryDataPoint[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { width: sw } = Dimensions.get("window");
  const chartW = sw - 48 - CHART_PAD_L - CHART_PAD_R;

  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [displayedIndex, setDisplayedIndex] = useState<number | null>(null);

  const sports = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data) {
      const s = d.sport.toLowerCase();
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([sport, count]) => ({ sport, count }));
  }, [data]);

  const filteredData = useMemo(
    () =>
      selectedSport
        ? data.filter((d) => d.sport.toLowerCase() === selectedSport)
        : data,
    [data, selectedSport]
  );
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef<Animated.CompositeAnimation | null>(null);

  const dismissTooltip = useCallback(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    if (fadeAnim.current) fadeAnim.current.stop();
    fadeAnim.current = Animated.timing(tooltipOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    });
    fadeAnim.current.start(({ finished }) => {
      if (finished) {
        setSelectedIndex(null);
        setDisplayedIndex(null);
      }
    });
  }, [tooltipOpacity]);

  const handleDotPress = useCallback(
    (i: number) => {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current);
        autoTimer.current = null;
      }
      if (fadeAnim.current) fadeAnim.current.stop();

      if (selectedIndex === i) {
        setSelectedIndex(null);
        dismissTooltip();
        return;
      }

      const isFirstShow = selectedIndex === null;
      setSelectedIndex(i);
      setDisplayedIndex(i);

      if (isFirstShow) {
        tooltipOpacity.setValue(0);
        fadeAnim.current = Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        });
        fadeAnim.current.start();
      } else {
        tooltipOpacity.setValue(1);
      }

      autoTimer.current = setTimeout(dismissTooltip, 3000);
    },
    [selectedIndex, tooltipOpacity, dismissTooltip]
  );

  const handleBackgroundPress = useCallback(() => {
    if (selectedIndex !== null) dismissTooltip();
  }, [selectedIndex, dismissTooltip]);

  useEffect(() => {
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (fadeAnim.current) fadeAnim.current.stop();
    };
  }, []);

  useEffect(() => {
    dismissTooltip();
  }, [selectedSport]);

  const scores = filteredData.map((d) => d[dimensionKey] as number);
  const latest = scores[scores.length - 1] ?? 0;
  const first = scores[0] ?? 0;
  const delta = Math.round(latest - first);

  const minScore = Math.max(0, Math.min(...scores) - 8);
  const maxScore = Math.min(100, Math.max(...scores) + 8);
  const range = maxScore - minScore || 1;

  function toX(i: number) {
    if (filteredData.length === 1) return CHART_PAD_L + chartW / 2;
    return CHART_PAD_L + (i / (filteredData.length - 1)) * chartW;
  }
  function toY(score: number) {
    return CHART_PAD_T + CHART_H_INNER - ((score - minScore) / range) * CHART_H_INNER;
  }

  const polyPts =
    filteredData.length > 1
      ? scores.map((s, i) => `${toX(i).toFixed(1)},${toY(s).toFixed(1)}`).join(" ")
      : "";

  const areaPath =
    filteredData.length > 1
      ? [
          `M ${toX(0).toFixed(1)} ${toY(scores[0]!).toFixed(1)}`,
          ...scores.slice(1).map((s, i) => `L ${toX(i + 1).toFixed(1)} ${toY(s).toFixed(1)}`),
          `L ${toX(filteredData.length - 1).toFixed(1)} ${(CHART_PAD_T + CHART_H_INNER).toFixed(1)}`,
          `L ${CHART_PAD_L.toFixed(1)} ${(CHART_PAD_T + CHART_H_INNER).toFixed(1)}`,
          "Z",
        ].join(" ")
      : null;

  const yTicks = [minScore, minScore + range * 0.5, maxScore];
  const totalSvgH = CHART_PAD_T + CHART_H_INNER + CHART_PAD_B;
  const latestBand = getScoreBand(latest);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        testID="dimension-history-sheet-backdrop"
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.60)", justifyContent: "flex-end" }}
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
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#3a3a5c",
              alignSelf: "center",
              marginBottom: 18,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <View>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#f1f1fa" }}>
                {label}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color }}>
                  {filteredData.length > 0 ? Math.round(latest) : "—"}
                </Text>
                <View
                  style={{
                    backgroundColor: color + "22",
                    borderRadius: 6,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color }}>
                    {latestBand}
                  </Text>
                </View>
                {filteredData.length >= 2 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather
                      name={delta >= 0 ? "arrow-up-right" : "arrow-down-right"}
                      size={12}
                      color={delta >= 0 ? "#22c55e" : "#f59e0b"}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_400Regular",
                        color: delta >= 0 ? "#22c55e" : "#f59e0b",
                      }}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta} over {filteredData.length} session{filteredData.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: 4 }}>
              <Feather name="x" size={20} color="#8888aa" />
            </TouchableOpacity>
          </View>

          {/* Sport Filter Pills */}
          {sports.length >= 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, flexDirection: "row", paddingBottom: 14 }}
            >
              <TouchableOpacity
                testID="sport-filter-all"
                onPress={() => setSelectedSport(null)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: selectedSport === null ? color + "20" : "#1a1a2e",
                  borderWidth: 1.5,
                  borderColor: selectedSport === null ? color : "#2a2a40",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: selectedSport === null ? "Inter_600SemiBold" : "Inter_400Regular",
                    color: selectedSport === null ? color : "#8888aa",
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {sports.map(({ sport, count }) => {
                const isActive = selectedSport === sport;
                return (
                  <TouchableOpacity
                    key={sport}
                    testID={`sport-filter-${sport}`}
                    onPress={() => setSelectedSport(sport)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 20,
                      backgroundColor: isActive ? color + "20" : "#1a1a2e",
                      borderWidth: 1.5,
                      borderColor: isActive ? color : "#2a2a40",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: isActive ? color : "#8888aa",
                        textTransform: "capitalize",
                      }}
                    >
                      {sport}
                    </Text>
                    <View
                      style={{
                        backgroundColor: isActive ? color + "30" : "#2a2a40",
                        borderRadius: 10,
                        paddingHorizontal: 5,
                        paddingVertical: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Inter_600SemiBold",
                          color: isActive ? color : "#55556e",
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Chart */}
          {filteredData.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ color: "#8888aa", fontFamily: "Inter_400Regular", fontSize: 13 }}>
                No history yet
              </Text>
            </View>
          ) : filteredData.length === 1 ? (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 36,
                borderWidth: 1,
                borderColor: "#2a2a40",
                borderRadius: 12,
                backgroundColor: "#12122080",
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 48,
                  fontFamily: "Inter_700Bold",
                  color,
                  lineHeight: 56,
                }}
              >
                {Math.round(latest)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                  color,
                  marginTop: 4,
                }}
              >
                {latestBand}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: "#8888aa",
                  marginTop: 16,
                  textAlign: "center",
                  paddingHorizontal: 24,
                }}
              >
                Scan again to see your trend
              </Text>
            </View>
          ) : (
            <Pressable onPress={handleBackgroundPress} style={{ position: "relative" }}>
              <Svg width={sw - 48} height={totalSvgH + 72} style={{ overflow: "visible" }}>
                {/* Y-axis grid + labels */}
                {yTicks.map((tick, ti) => {
                  const y = toY(tick);
                  return (
                    <React.Fragment key={ti}>
                      <Line
                        x1={CHART_PAD_L}
                        y1={y}
                        x2={CHART_PAD_L + chartW}
                        y2={y}
                        stroke="#2a2a40"
                        strokeWidth={1}
                      />
                      <SvgText
                        x={CHART_PAD_L - 4}
                        y={y + 3}
                        fontSize={8}
                        fill="#55556e"
                        fontFamily="Inter_400Regular"
                        textAnchor="end"
                      >
                        {Math.round(tick)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Area fill */}
                {areaPath && <Path d={areaPath} fill={color + "18"} />}

                {/* Line */}
                <Polyline
                  points={polyPts}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {filteredData.map((d, i) => {
                  const isSelected = selectedIndex === i;
                  const isLatest = i === filteredData.length - 1;
                  const cx = toX(i);
                  const cy = toY(scores[i]!);
                  const dotR = isSelected ? 8 : isLatest ? 6 : 4;
                  return (
                    <React.Fragment key={i}>
                      {isLatest && !isSelected && (
                        <Circle cx={cx} cy={cy} r={10} fill={color + "22"} />
                      )}
                      {isSelected && (
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={14}
                          fill={color + "30"}
                          stroke={color}
                          strokeWidth={1.5}
                        />
                      )}
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={18}
                        fill="transparent"
                        onPress={() => handleDotPress(i)}
                        testID="dimension-dot-hit-target"
                      />
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={dotR}
                        fill={color}
                        stroke={isLatest || isSelected ? "#0e0e1a" : "none"}
                        strokeWidth={isLatest || isSelected ? 2 : 0}
                      />
                    </React.Fragment>
                  );
                })}

                {/* X-axis date labels */}
                {(() => {
                  const labels: { i: number; text: string }[] = [];
                  if (filteredData.length === 2) {
                    labels.push({ i: 0, text: formatDate(filteredData[0]!.date) });
                    labels.push({ i: 1, text: formatDate(filteredData[1]!.date) });
                  } else {
                    labels.push({ i: 0, text: formatDate(filteredData[0]!.date) });
                    labels.push({ i: filteredData.length - 1, text: formatDate(filteredData[filteredData.length - 1]!.date) });
                  }
                  return labels.map(({ i, text }) => (
                    <SvgText
                      key={i}
                      x={toX(i)}
                      y={CHART_PAD_T + CHART_H_INNER + 20}
                      fontSize={9}
                      fill="#55556e"
                      fontFamily="Inter_400Regular"
                      textAnchor={i === 0 ? "start" : "end"}
                    >
                      {text}
                    </SvgText>
                  ));
                })()}
              </Svg>

              {/* Tooltip overlay */}
              {displayedIndex !== null &&
                (() => {
                  const sel = filteredData[displayedIndex]!;
                  const selScore = scores[displayedIndex]!;
                  const cx = toX(displayedIndex);
                  const cy = toY(selScore);
                  const band = getScoreBand(selScore);
                  const canNavigate = !!sel.analysisId;
                  const tooltipW = 130;
                  const tooltipH = canNavigate ? 84 : 68;
                  const arrowH = 7;
                  const svgW = sw - 48;
                  const rawTx = cx - tooltipW / 2;
                  const tx = Math.max(4, Math.min(rawTx, svgW - tooltipW - 4));
                  const placeAbove = cy - CHART_PAD_T > tooltipH + arrowH + 10;
                  const ty = placeAbove ? cy - tooltipH - arrowH - 12 : cy + 14 + arrowH;
                  const arrowX = cx - tx;
                  const cornerR = 8;
                  const clampedArrowX = Math.max(
                    cornerR + 4,
                    Math.min(arrowX, tooltipW - cornerR - 4)
                  );

                  function handleTooltipPress() {
                    if (!canNavigate) return;
                    onClose();
                    router.push(`/analysis/skeleton/${sel.analysisId}` as any);
                  }

                  return (
                    <Animated.View
                      key="tooltip"
                      testID="dimension-tooltip"
                      style={[
                        tooltipStyles.container,
                        {
                          left: tx,
                          top: ty,
                          width: tooltipW,
                          height: tooltipH,
                          borderColor: color,
                          opacity: tooltipOpacity,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={canNavigate ? handleTooltipPress : undefined}
                        style={tooltipStyles.inner}
                      >
                        {placeAbove ? (
                          <View
                            style={[
                              tooltipStyles.arrowDown,
                              { left: clampedArrowX - 6, borderTopColor: color },
                            ]}
                          />
                        ) : (
                          <View
                            style={[
                              tooltipStyles.arrowUp,
                              { left: clampedArrowX - 6, borderBottomColor: color },
                            ]}
                          />
                        )}
                        <Text style={[tooltipStyles.score, { color }]}>
                          {Math.round(selScore)}
                        </Text>
                        <Text style={[tooltipStyles.band, { color }]}>{band}</Text>
                        <Text style={tooltipStyles.meta}>
                          {formatDate(sel.date)} · {toTitleCase(sel.sport)}
                        </Text>
                        {canNavigate && (
                          <Text style={tooltipStyles.navHint}>tap to open →</Text>
                        )}
                      </Pressable>
                    </Animated.View>
                  );
                })()}
            </Pressable>
          )}

          <Text
            style={{
              fontSize: 11,
              color: "#55556e",
              fontFamily: "Inter_400Regular",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {filteredData.length} session{filteredData.length === 1 ? "" : "s"} · {label.toLowerCase()} history{selectedSport ? ` · ${toTitleCase(selectedSport)}` : ""}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const tooltipStyles = StyleSheet.create({
  container: {
    position: "absolute",
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  arrowDown: {
    position: "absolute",
    bottom: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowUp: {
    position: "absolute",
    top: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  score: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  band: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  meta: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "#8888aa",
    marginTop: 2,
  },
  inner: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 6,
    width: "100%" as const,
  },
  navHint: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#00C2FF",
    marginTop: 3,
  },
});
