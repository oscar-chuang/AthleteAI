/**
 * Pure helpers + constants for the frozen-frame pose skeleton.
 * No React, no Expo, no side effects — shared between the skeleton screen,
 * the FrozenSkeleton viewer, and the test suite.
 */

import type { JointKey } from "./analysisUtils";

export type Landmark = { x: number; y: number; v?: number };

export interface JointReading {
  deg: number;
  lvl: number; // 0 safe · 1 caution · 2 high risk
}

/**
 * A single frozen frame measured during the one-time scan: the cropped image of
 * the athlete, that frame's pose landmarks (crop-local, normalised 0..1) and the
 * per-joint angle/risk readings at that instant. Everything the native viewer
 * needs to redraw the skeleton on a static image — no live tracking required.
 */
export interface Capture {
  id: string;
  kind: "worst" | "joint" | "clear";
  time: number;
  aspect: number; // width / height of the captured crop image
  frame: string; // data-URL JPEG of the cropped athlete
  lm: Landmark[]; // crop-local normalised landmarks (0..1)
  jr: Partial<Record<JointKey, JointReading>>;
  joints: JointKey[]; // joints flagged (lvl ≥ 1) at this frame, worst-first
  maxLvl: number;
}

export const RISK_COLORS = ["#22c55e", "#f59e0b", "#ef4444"] as const;
export const RISK_WORD = ["SAFE", "CAUTION", "HIGH RISK"] as const;

export const JOINT_LABEL: Record<JointKey, string> = {
  leftKnee: "L Knee", rightKnee: "R Knee",
  leftHip: "L Hip", rightHip: "R Hip",
  leftElbow: "L Elbow", rightElbow: "R Elbow",
};

// MediaPipe Pose landmark indices for the six tracked joints.
export const JOINT_LANDMARK: Record<JointKey, number> = {
  leftKnee: 25, rightKnee: 26, leftHip: 23, rightHip: 24, leftElbow: 13, rightElbow: 14,
};

export const LANDMARK_TO_JOINT: Record<number, JointKey> = {
  25: "leftKnee", 26: "rightKnee", 23: "leftHip", 24: "rightHip", 13: "leftElbow", 14: "rightElbow",
};

// Bone connections (MediaPipe Pose topology, 33 landmarks).
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [15, 17], [15, 19], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [18, 20],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

export const LEFT_IDX = new Set([11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]);
export const RIGHT_IDX = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);

// Landmarks we draw dots for (head anchor + torso + limbs).
export const KEY_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export interface Rect { left: number; top: number; width: number; height: number }

/**
 * Letterbox rect of a contain-fit image of the given aspect (w/h) inside a box.
 * Landmarks are normalised against the *image*, so we must map them through the
 * actual rendered image rect — not the full container — or they drift on
 * non-matching aspect ratios.
 */
export function containRect(boxW: number, boxH: number, aspect: number): Rect {
  if (!(boxW > 0) || !(boxH > 0) || !(aspect > 0)) {
    return { left: 0, top: 0, width: Math.max(0, boxW || 0), height: Math.max(0, boxH || 0) };
  }
  const boxAspect = boxW / boxH;
  let width: number;
  let height: number;
  if (aspect > boxAspect) { width = boxW; height = boxW / aspect; }
  else { height = boxH; width = boxH * aspect; }
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

/** Project a normalised landmark (0..1) into a letterboxed image rect. */
export function projectLandmark(lm: Landmark, rect: Rect): { x: number; y: number } {
  return { x: rect.left + lm.x * rect.width, y: rect.top + lm.y * rect.height };
}

/**
 * Pick the hero capture for the top of the screen: the dedicated worst-frame if
 * present, else the highest-risk capture, else the clear-frame fallback, else the
 * first available.
 */
export function pickHeroCapture(captures: Capture[]): Capture | null {
  if (!captures.length) return null;
  const worst = captures.find((c) => c.kind === "worst");
  if (worst) return worst;
  const ranked = [...captures].sort((a, b) => b.maxLvl - a.maxLvl);
  if (ranked[0] && ranked[0].maxLvl > 0) return ranked[0];
  return captures.find((c) => c.kind === "clear") ?? captures[0];
}

/**
 * Best capture to inspect a set of joints: the capture whose readings for those
 * joints carry the highest risk. Falls back to any capture that merely *has* a
 * reading for one of the joints, then to the hero capture.
 */
export function captureForJoints(captures: Capture[], joints: JointKey[]): Capture | null {
  if (!captures.length) return null;
  if (!joints.length) return pickHeroCapture(captures);
  const wanted = new Set(joints);
  let best: Capture | null = null;
  let bestScore = -1;
  for (const c of captures) {
    let score = -1;
    for (const j of joints) {
      const reading = c.jr[j];
      if (reading) score = Math.max(score, reading.lvl);
      else if (wanted.has(j) && c.joints.includes(j)) score = Math.max(score, 0);
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0 && best ? best : pickHeroCapture(captures);
}

/**
 * Derive a scan-quality badge (high / medium / low) from the landmark visibility
 * scores stored in a capture. MediaPipe emits per-landmark visibility in [0, 1];
 * averaging the tracked KEY_LANDMARKS gives a quick proxy for how well the model
 * saw the athlete.
 *
 * Thresholds chosen empirically:
 *  ≥ 0.70 → "high"   (clear subject, good lighting)
 *  ≥ 0.45 → "medium" (some occlusion or poor contrast)
 *  <  0.45 → "low"   (heavy occlusion, motion blur, or detection nearly failed)
 */
export function computeScanQuality(capture: Capture): "high" | "medium" | "low" {
  if (!capture.lm || capture.lm.length === 0) return "low";
  const tracked = KEY_LANDMARKS.map((i) => capture.lm[i]?.v ?? 0);
  const avg = tracked.reduce((s, v) => s + v, 0) / tracked.length;
  if (avg >= 0.70) return "high";
  if (avg >= 0.45) return "medium";
  return "low";
}

/**
 * Best-effort match of a free-form injury-risk joint string (from the AI, e.g.
 * "Left Knee", "knee", "lead elbow") to the structured joint keys a tip targets.
 * Returns true when the risk's joint name plausibly refers to one of the tip joints.
 */
export function riskMatchesJoints(riskJoint: string, joints: JointKey[]): boolean {
  if (!riskJoint || !joints.length) return false;
  const norm = riskJoint.toLowerCase();
  const part = norm.includes("knee") ? "knee" : norm.includes("hip") ? "hip" : norm.includes("elbow") ? "elbow" : null;
  if (!part) return false;
  const side = norm.includes("left") || norm.includes("lead") ? "left"
    : norm.includes("right") || norm.includes("rear") || norm.includes("trail") ? "right"
    : null;
  return joints.some((j) => {
    const jl = j.toLowerCase();
    if (!jl.includes(part)) return false;
    if (!side) return true; // joint named without a side → match either side
    return jl.includes(side);
  });
}
