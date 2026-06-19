import type { ComponentProps } from "react";
import type { Feather } from "@expo/vector-icons";
import type { AnalysisRecord } from "@/lib/api";

export type FeatherIconName = ComponentProps<typeof Feather>["name"];

export const SCORE_KEYS = [
  "technique",
  "power",
  "balance",
  "consistency",
  "mobility",
  "speed",
] as const;

export type ScoreKey = (typeof SCORE_KEYS)[number];

export const SCORE_META: Record<ScoreKey, { icon: FeatherIconName; desc: string }> = {
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

export function scoreForKey(analysis: AnalysisRecord, key: ScoreKey): number {
  return (analysis as any)[`${key}Score`] ?? 0;
}
