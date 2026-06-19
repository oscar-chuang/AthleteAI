import type { JointKey } from "@/lib/api";

export type MetricKey = "overall" | "technique" | "power" | "balance" | "consistency" | "mobility" | "speed";

export interface SportConfig {
  joints: JointKey[];
  metrics: MetricKey[];
  accentColor: string;
  icon: string;
}

const DEFAULT_JOINTS: JointKey[] = ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"];
const DEFAULT_METRICS: MetricKey[] = ["overall", "technique", "power", "balance", "consistency", "mobility", "speed"];

const SPORT_CONFIGS: Record<string, SportConfig> = {
  running: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "speed", "consistency", "mobility"],
    accentColor: "#f59e0b",
    icon: "activity",
  },
  weightlifting: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "power", "balance", "mobility"],
    accentColor: "#ef4444",
    icon: "trending-up",
  },
  powerlifting: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "power", "balance", "consistency"],
    accentColor: "#dc2626",
    icon: "trending-up",
  },
  basketball: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "power", "speed", "balance"],
    accentColor: "#f97316",
    icon: "circle",
  },
  soccer: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "speed", "balance", "consistency"],
    accentColor: "#22c55e",
    icon: "circle",
  },
  volleyball: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "power", "balance", "speed"],
    accentColor: "#3b82f6",
    icon: "circle",
  },
  tennis: {
    joints: ["leftElbow", "rightElbow", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "power", "speed", "consistency"],
    accentColor: "#84cc16",
    icon: "circle",
  },
  baseball: {
    joints: ["leftElbow", "rightElbow", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "power", "speed", "balance"],
    accentColor: "#ef4444",
    icon: "circle",
  },
  swimming: {
    joints: ["leftElbow", "rightElbow", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "speed", "consistency", "mobility"],
    accentColor: "#06b6d4",
    icon: "droplet",
  },
  gymnastics: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "balance", "mobility", "consistency"],
    accentColor: "#a855f7",
    icon: "star",
  },
  cycling: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "power", "consistency", "mobility"],
    accentColor: "#f59e0b",
    icon: "navigation",
  },
  golf: {
    joints: ["leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "balance", "consistency", "power"],
    accentColor: "#22c55e",
    icon: "flag",
  },
  boxing: {
    joints: ["leftElbow", "rightElbow", "leftKnee", "rightKnee"],
    metrics: ["overall", "technique", "power", "speed", "balance"],
    accentColor: "#ef4444",
    icon: "shield",
  },
  wrestling: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "power", "balance", "technique", "consistency"],
    accentColor: "#dc2626",
    icon: "shield",
  },
  fencing: {
    joints: ["leftKnee", "rightKnee", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "speed", "balance", "consistency"],
    accentColor: "#6366f1",
    icon: "zap",
  },
  rowing: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "power", "consistency", "mobility"],
    accentColor: "#0ea5e9",
    icon: "anchor",
  },
  rugby: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "power", "speed", "technique", "balance"],
    accentColor: "#16a34a",
    icon: "circle",
  },
  hockey: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "technique", "speed", "balance", "power"],
    accentColor: "#0284c7",
    icon: "circle",
  },
  badminton: {
    joints: ["leftElbow", "rightElbow", "leftKnee", "rightKnee"],
    metrics: ["overall", "technique", "speed", "balance", "consistency"],
    accentColor: "#f43f5e",
    icon: "circle",
  },
  yoga: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
    metrics: ["overall", "balance", "mobility", "technique", "consistency"],
    accentColor: "#8b5cf6",
    icon: "heart",
  },
  crossfit: {
    joints: ["leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow"],
    metrics: ["overall", "technique", "power", "consistency", "mobility"],
    accentColor: "#f97316",
    icon: "zap",
  },
};

export function getSportConfig(sport: string): SportConfig {
  const normalized = sport.toLowerCase().replace(/\s+/g, "_");
  return SPORT_CONFIGS[normalized] ?? {
    joints: DEFAULT_JOINTS,
    metrics: DEFAULT_METRICS,
    accentColor: "#6c63ff",
    icon: "video",
  };
}

export const JOINT_DISPLAY: Record<string, string> = {
  leftKnee: "Left Knee",
  rightKnee: "Right Knee",
  leftHip: "Left Hip",
  rightHip: "Right Hip",
  leftElbow: "Left Elbow",
  rightElbow: "Right Elbow",
};

export const SPORT_ICONS: Record<string, string> = {
  running: "activity",
  weightlifting: "trending-up",
  basketball: "circle",
  golf: "flag",
  tennis: "circle",
  swimming: "droplet",
  crossfit: "zap",
  boxing: "shield",
  soccer: "circle",
  gymnastics: "star",
  cycling: "navigation",
  fencing: "zap",
  rowing: "anchor",
  volleyball: "circle",
  baseball: "circle",
  wrestling: "shield",
  rugby: "circle",
  hockey: "circle",
  yoga: "heart",
  badminton: "circle",
  lacrosse: "circle",
  football: "circle",
  other: "video",
  unknown: "video",
  default: "video",
};
