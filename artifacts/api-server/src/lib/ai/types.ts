import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, (i + 1) * 1500));
    }
  }
  throw lastErr;
}

export type JointKey =
  | "leftKnee" | "rightKnee"
  | "leftHip" | "rightHip"
  | "leftElbow" | "rightElbow";

export const JOINT_KEYS: JointKey[] = [
  "leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow",
];

export const JOINT_KEY_SET = new Set<string>(JOINT_KEYS);

export const RISK_LABEL = ["safe", "caution", "HIGH RISK"];

export interface AthleteProfile {
  name?: string;
  level?: string;
  goals?: string[];
  injuryConcerns?: string[];
}

export interface JointAngles {
  leftKnee?: number;
  rightKnee?: number;
  leftHip?: number;
  rightHip?: number;
  leftElbow?: number;
  rightElbow?: number;
}

export interface JointRisks {
  leftKnee?: number;
  rightKnee?: number;
  leftHip?: number;
  rightHip?: number;
  leftElbow?: number;
  rightElbow?: number;
}

export function sanitizeJoints(raw: unknown): JointKey[] {
  if (!Array.isArray(raw)) return [];
  const out: JointKey[] = [];
  for (const j of raw) {
    if (typeof j === "string" && JOINT_KEY_SET.has(j) && !out.includes(j as JointKey)) {
      out.push(j as JointKey);
    }
  }
  return out;
}

export function deriveJointsFromText(text: string): JointKey[] {
  const t = text.toLowerCase();
  const found = new Set<JointKey>();
  const nouns: Array<[string, JointKey, JointKey]> = [
    ["knee", "leftKnee", "rightKnee"],
    ["hip", "leftHip", "rightHip"],
    ["elbow", "leftElbow", "rightElbow"],
  ];
  for (const [noun, left, right] of nouns) {
    if (!t.includes(noun)) continue;
    const hasLeft = new RegExp(`left[\\w\\s-]{0,14}${noun}|${noun}[\\w\\s-]{0,14}left`).test(t);
    const hasRight = new RegExp(`right[\\w\\s-]{0,14}${noun}|${noun}[\\w\\s-]{0,14}right`).test(t);
    if (hasLeft) found.add(left);
    if (hasRight) found.add(right);
    if (!hasLeft && !hasRight) { found.add(left); found.add(right); }
  }
  return JOINT_KEYS.filter((k) => found.has(k));
}

export function collectFlaggedJoints(risks?: JointRisks | null): JointKey[] {
  if (!risks) return [];
  return JOINT_KEYS
    .filter((k) => (risks[k] ?? 0) >= 1)
    .sort((a, b) => (risks[b] ?? 0) - (risks[a] ?? 0));
}

export function formatJointAngles(angles: JointAngles, risks: JointRisks): string {
  const joints: { label: string; deg?: number; lvl?: number }[] = [
    { label: "Left knee",   deg: angles.leftKnee,   lvl: risks.leftKnee   },
    { label: "Right knee",  deg: angles.rightKnee,  lvl: risks.rightKnee  },
    { label: "Left hip",    deg: angles.leftHip,    lvl: risks.leftHip    },
    { label: "Right hip",   deg: angles.rightHip,   lvl: risks.rightHip   },
    { label: "Left elbow",  deg: angles.leftElbow,  lvl: risks.leftElbow  },
    { label: "Right elbow", deg: angles.rightElbow, lvl: risks.rightElbow },
  ].filter((j) => j.deg != null);

  if (joints.length === 0) return "";

  return `\nMeasured joint angles from the highest-risk frame (MediaPipe biomechanics scan):
${joints.map((j) => `  ${j.label}: ${Math.round(j.deg!)}° [${RISK_LABEL[j.lvl ?? 0]}]`).join("\n")}

Use these ACTUAL measurements to drive your scoring — they are real numbers from the video, not estimates:
- Joints flagged as HIGH RISK: the related score (technique, balance, or mobility) must be in the "Focus Here" band (below 65)
- Joints flagged as caution: the related score should be in the "On Track" band (65–79)
- Joints flagged as safe: those scores can be Strong (80+) if the sport profile supports it
- If ANY joint is HIGH RISK, the overall injury risks section must name that joint specifically`;
}
