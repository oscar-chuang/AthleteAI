import { Feather } from "@expo/vector-icons";
import { ImageSourcePropType } from "react-native";

export interface GuidanceTip {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  text: string;
}

export interface ExampleCardData {
  id: string;
  label: string;
  good: boolean;
  image: ImageSourcePropType;
  description: string;
}

export const BEST_PRACTICES: GuidanceTip[] = [
  { id: "bp-1", icon: "user",     text: "Keep your full body visible in frame at all times" },
  { id: "bp-2", icon: "sun",      text: "Record in good lighting — natural daylight works best" },
  { id: "bp-3", icon: "maximize", text: "Use a stable surface or tripod to avoid camera shake" },
  { id: "bp-4", icon: "eye",      text: "Position the camera at hip or chest height, side-on or front-on" },
  { id: "bp-5", icon: "film",     text: "Keep the clip under 90 seconds to focus on one movement" },
];

export const COMMON_MISTAKES: GuidanceTip[] = [
  { id: "cm-1", icon: "zoom-out", text: "Standing too far away — we can't see your joints clearly" },
  { id: "cm-2", icon: "crop",     text: "Limbs cut off at the edges — arms or legs leave the frame" },
  { id: "cm-3", icon: "moon",     text: "Poor lighting or strong backlight — silhouette only, no detail" },
  { id: "cm-4", icon: "users",    text: "Multiple people in shot — pose detection may track the wrong person" },
];

export const EXAMPLE_CARDS: ExampleCardData[] = [
  {
    id: "ex-1",
    label: "Full body in frame",
    good: true,
    image: require("@/assets/recording-tips/good.png"),
    description: "Head to toe visible, clear lighting",
  },
  {
    id: "ex-2",
    label: "Too far away",
    good: false,
    image: require("@/assets/recording-tips/too-far.png"),
    description: "Joints too small to detect accurately",
  },
  {
    id: "ex-3",
    label: "Limbs cropped",
    good: false,
    image: require("@/assets/recording-tips/cropped.png"),
    description: "Arms or legs leave the frame",
  },
  {
    id: "ex-4",
    label: "Poor lighting",
    good: false,
    image: require("@/assets/recording-tips/dark.png"),
    description: "Silhouette only — no detail visible",
  },
];
