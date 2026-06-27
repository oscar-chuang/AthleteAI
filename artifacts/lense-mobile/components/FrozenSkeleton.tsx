/**
 * FrozenSkeleton — renders a pose skeleton over a *static* captured frame.
 *
 * There is no live video and no MediaPipe here: the landmarks were measured once
 * during the scan and frozen into the Capture. Because we only ever draw stored
 * landmarks on a still image, the overlay can never drift onto a different person.
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, G, Line, Rect as SvgRect, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { JointKey } from "@/utils/analysisUtils";
import {
  type Capture,
  JOINT_LABEL,
  JOINT_LANDMARK,
  KEY_LANDMARKS,
  LANDMARK_TO_JOINT,
  LEFT_IDX,
  POSE_CONNECTIONS,
  RIGHT_IDX,
  RISK_COLORS,
  containRect,
  projectLandmark,
} from "@/utils/skeleton";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const VIS = 0.4; // hide landmarks the model wasn't confident about

type Props = {
  capture: Capture;
  width: number;
  height: number;
  emphasize?: JointKey[];
  showAngles?: boolean;
  /** When true, shows a dark background instead of the freeze-frame photo.
   *  Use this during scrubbing so the static photo doesn't misalign with the
   *  animated skeleton overlay. */
  hidePhoto?: boolean;
};

function lvlForIndex(capture: Capture, idx: number): number {
  const joint = LANDMARK_TO_JOINT[idx];
  return joint ? (capture.jr[joint]?.lvl ?? -1) : -1;
}

function boneColor(aIdx: number, bIdx: number, aLvl: number, bLvl: number): string {
  const risk = Math.max(aLvl, bLvl);
  if (risk >= 1) return RISK_COLORS[Math.min(2, risk)];
  if (LEFT_IDX.has(aIdx) && LEFT_IDX.has(bIdx)) return "#38bdf8";
  if (RIGHT_IDX.has(aIdx) && RIGHT_IDX.has(bIdx)) return "#c084fc";
  return "rgba(226,232,240,0.7)";
}

export default function FrozenSkeleton({
  capture,
  width,
  height,
  emphasize = [],
  showAngles = true,
  hidePhoto = false,
}: Props) {
  const pulse = useSharedValue(0);
  const emphasizeKey = emphasize.join(",");

  useEffect(() => {
    if (emphasize.length) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emphasizeKey]);

  const rect = useMemo(
    () => containRect(width, height, capture.aspect),
    [width, height, capture.aspect],
  );

  const scale = Math.max(0.6, Math.min(rect.width, rect.height) / 320);
  const dotR = 4 * scale;
  const jointR = 6.5 * scale;
  const strokeW = 3.2 * scale;
  const ringBase = jointR + 4 * scale;
  const ringGrow = 9 * scale;

  const ringProps = useAnimatedProps(() => ({
    r: ringBase + pulse.value * ringGrow,
    opacity: 0.9 - pulse.value * 0.6,
  }));

  const lm = capture.lm ?? [];
  const emphasizeSet = useMemo(() => new Set(emphasize), [emphasizeKey]);

  const pt = (idx: number) => {
    const l = lm[idx];
    if (!l || (l.v ?? 1) < VIS) return null;
    return projectLandmark(l, rect);
  };

  // Joint angle/risk callouts to render (emphasised joints, else all flagged).
  const calloutJoints: JointKey[] = emphasize.length
    ? emphasize
    : capture.joints;

  return (
    <View style={[styles.wrap, { width, height }]}>
      {hidePhoto ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#07070f" }]} />
      ) : (
        <Image
          source={{ uri: capture.frame }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={120}
          cachePolicy="memory"
        />
      )}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Bones */}
        <G>
          {POSE_CONNECTIONS.map(([a, b], i) => {
            const pa = pt(a);
            const pb = pt(b);
            if (!pa || !pb) return null;
            return (
              <Line
                key={`bone-${i}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={boneColor(a, b, lvlForIndex(capture, a), lvlForIndex(capture, b))}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        {/* Landmark dots */}
        <G>
          {KEY_LANDMARKS.map((idx) => {
            const p = pt(idx);
            if (!p) return null;
            const joint = LANDMARK_TO_JOINT[idx];
            const lvl = lvlForIndex(capture, idx);
            const isJoint = !!joint;
            const color = lvl >= 1 ? RISK_COLORS[Math.min(2, lvl)] : isJoint ? "#f8fafc" : "rgba(248,250,252,0.85)";
            return (
              <Circle
                key={`dot-${idx}`}
                cx={p.x}
                cy={p.y}
                r={isJoint ? jointR : dotR}
                fill={color}
                stroke="rgba(7,7,15,0.85)"
                strokeWidth={1.2 * scale}
              />
            );
          })}
        </G>

        {/* Emphasis pulse rings */}
        <G>
          {emphasize.map((j) => {
            const idx = JOINT_LANDMARK[j];
            const p = pt(idx);
            if (!p) return null;
            const lvl = capture.jr[j]?.lvl ?? 0;
            return (
              <AnimatedCircle
                key={`ring-${j}`}
                cx={p.x}
                cy={p.y}
                fill="none"
                stroke={RISK_COLORS[Math.min(2, lvl)]}
                strokeWidth={2.4 * scale}
                animatedProps={ringProps}
              />
            );
          })}
        </G>

        {/* Angle callouts */}
        {showAngles && (
          <G>
            {calloutJoints.map((j) => {
              const reading = capture.jr[j];
              if (!reading) return null;
              const idx = JOINT_LANDMARK[j];
              const p = pt(idx);
              if (!p) return null;
              const lvl = reading.lvl;
              const label = `${JOINT_LABEL[j]}  ${Math.round(reading.deg)}\u00B0`;
              const w = (label.length * 6.4 + 14) * scale;
              const h = 19 * scale;
              const onLeft = p.x > rect.left + rect.width * 0.55;
              const bx = onLeft ? p.x - w - 9 * scale : p.x + 9 * scale;
              const by = Math.max(rect.top + 2, p.y - h / 2);
              return (
                <G key={`call-${j}`}>
                  <SvgRect
                    x={bx}
                    y={by}
                    width={w}
                    height={h}
                    rx={h / 2}
                    fill="rgba(7,7,15,0.82)"
                    stroke={RISK_COLORS[Math.min(2, lvl)]}
                    strokeWidth={1.2 * scale}
                  />
                  <SvgText
                    x={bx + w / 2}
                    y={by + h / 2 + 3.6 * scale}
                    fill="#f8fafc"
                    fontSize={11 * scale}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#05050c",
  },
});
