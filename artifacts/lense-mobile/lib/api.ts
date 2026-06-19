import AsyncStorage from "@react-native-async-storage/async-storage";

const _base =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "http://localhost:8080");
const API_URL = `${_base}/api`;

const TOKEN_KEY = "auth_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Global 401 handler — registered by AuthProvider so any expired token
// anywhere in the app triggers an automatic logout.
let _onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Request failed" }));
      // If the token is rejected on a protected route, auto-logout everywhere.
      if (res.status === 401 && !path.startsWith("/auth/")) {
        await clearToken();
        _onUnauthorized?.();
      }
      throw new ApiError(body.error ?? "Request failed", res.status, body.code);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  signup: (email: string, password: string, name: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      "/auth/signup",
      { method: "POST", body: JSON.stringify({ email, password, name }) }
    ),

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),

  me: () =>
    request<{
      user: { id: string; email: string };
      profile: Profile | null;
      subscription: SubscriptionRecord | null;
    }>("/auth/me"),
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  userId: string;
  name: string;
  sport: string;
  level: "beginner" | "intermediate" | "advanced" | "elite";
  goals: string[];
  injuryConcerns: string[];
  weeklyGoal: number;
  trainingDays: number[];
  checkInHour: number;
  weeklyProgress: number;
  streakDays: number;
  avatarUrl?: string | null;
}

export interface ProfileStats {
  streak: number;
  totalAnalyses: number;
  thisWeekCount: number;
  lastWeekCount: number;
  personalBests: Record<string, number>;
  latestScore: number | null;
  scoreDelta: number | null;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  tier: "free" | "pro" | "elite";
  status: string;
  currentPeriodEnd?: string;
}

export const profile = {
  get: () =>
    request<{ profile: Profile; subscription: SubscriptionRecord }>("/profile"),

  update: (data: Partial<Omit<Profile, "id" | "userId">>) =>
    request<{ profile: Profile }>("/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  stats: () =>
    request<ProfileStats>("/profile/stats"),
};

// ─── Analyses ─────────────────────────────────────────────────────────────────

export interface AnalysisRecord {
  id: string;
  userId: string;
  title: string;
  sport: string;
  status: "pending" | "processing" | "complete" | "failed";
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  overallScore?: number;
  techniqueScore?: number;
  powerScore?: number;
  balanceScore?: number;
  consistencyScore?: number;
  mobilityScore?: number;
  speedScore?: number;
  strengths: string[];
  improvements: string[];
  jointAngles?: Record<string, number>;
  jointRisks?: Record<string, number>;
  biomechanicsApplied?: boolean;
  uploadedAt: string;
}

// The six joints the on-screen pose skeleton tracks. A tip's `joints` reference
// these keys so the mobile app can highlight the exact joints a tip is about.
export type JointKey =
  | "leftKnee" | "rightKnee"
  | "leftHip" | "rightHip"
  | "leftElbow" | "rightElbow";

export const JOINT_KEYS: JointKey[] = [
  "leftKnee", "rightKnee", "leftHip", "rightHip", "leftElbow", "rightElbow",
];

export interface DrillRecord {
  name: string;
  sets: string;
  reps: string;
  cue: string;
  drillFeelCue?: string;
}

export interface TipRecord {
  id: string;
  tipType: "injury" | "performance";
  category: string;
  severity: string;
  title: string;
  videoObservation?: string;
  description: string;
  whyItMatters?: string;
  drill?: DrillRecord;
  source?: string;
  joints?: JointKey[];
}

export interface RiskRecord {
  id: string;
  joint: string;
  riskPercent: number;
  description: string;
  prevention: string;
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

export interface FrameTickJR {
  deg: number;
  lvl: number;
}

export interface FrameTick {
  t: number;
  lm: { x: number; y: number; v: number }[];
  angles: Partial<Record<JointKey, number>>;
  jr: Partial<Record<JointKey, FrameTickJR>>;
}

export interface FlaggedMoment {
  t: number;
  joints: JointKey[];
  angles: Partial<Record<JointKey, number>>;
  risks: Partial<Record<JointKey, number>>;
}

export interface CoachingMoment {
  id: string;
  timestamp: number;
  joints: JointKey[];
  whatWeNoticed: string;
  whyItMatters: string;
  suggestedFix: string;
  confidence: number;
  confidenceNote?: string;
  evidence: { joint?: string; angle?: number; timestamp?: number };
  riskLevel: number;
}

export interface MovementSummary {
  flowScore: number;
  efficiencyScore: number;
  bodyControlScore: number;
  consistencyScore: number;
  rhythmScore: number;
  overallScore: number;
  topStrengths: string[];
  topImprovements: string[];
  mostImportantFix: string;
  coachSummary: string;
}

export interface TickStats {
  joints: Record<string, { avgAngle: number; maxRisk: number; timesFlag: number }>;
  totalTicks: number;
  duration: number;
}

export const analyses = {
  list: () =>
    request<{ analyses: AnalysisRecord[] }>("/analyses"),

  create: (data: {
    title: string;
    sport: string;
    videoUrl?: string;
    duration?: number;
    jointAngles?: Record<string, number>;
  }) =>
    request<{ analysis: AnalysisRecord }>("/analyses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: string) =>
    request<{ analysis: AnalysisRecord; tips: TipRecord[]; injuryRisks: RiskRecord[] }>(
      `/analyses/${id}`
    ),

  update: (id: string, data: { jointAngles?: JointAngles; jointRisks?: JointRisks; frameBase64?: string; sport?: string }) =>
    request<{ success: boolean; improvements?: Array<{ joint: string; oldRisk: number; newRisk: number }> }>(`/analyses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/analyses/${id}`, { method: "DELETE" }),

  detectSport: (imageBase64: string) =>
    request<{ sport: string }>("/analyses/detect-sport", {
      method: "POST",
      body: JSON.stringify({ imageBase64 }),
    }, 25000),

  coachingMoments: (id: string, flaggedMoments?: FlaggedMoment[]) =>
    request<{ moments: CoachingMoment[] }>(`/analyses/${id}/coaching-moments`, {
      method: "POST",
      body: JSON.stringify({ flaggedMoments: flaggedMoments ?? [] }),
    }, 45000),

  movementSummary: (id: string, tickStats?: TickStats) =>
    request<{ summary: MovementSummary }>(`/analyses/${id}/movement-summary`, {
      method: "POST",
      body: JSON.stringify({ tickStats: tickStats ?? null }),
    }, 45000),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  referencedAnalysisId?: string;
  createdAt: string;
}

export const chat = {
  history: () =>
    request<{ messages: ChatRecord[] }>("/chat"),

  send: (content: string, referencedAnalysisId?: string) =>
    request<{ userMessage: ChatRecord; assistantMessage: ChatRecord }>("/chat", {
      method: "POST",
      body: JSON.stringify({ content, referencedAnalysisId }),
    }, 30000),

  clear: () => request<{ success: boolean }>("/chat", { method: "DELETE" }),

  suggestions: () =>
    request<{ suggestions: string[]; hasCompletedAnalyses: boolean }>("/chat/suggestions"),
};

// ─── Joint Trends ─────────────────────────────────────────────────────────────

export interface JointDataPoint {
  analysisId: string;
  date: string;
  sport: string;
  angle: number;
  risk: number;
}

export interface JointImprovement {
  joint: string;
  deltaDeg: number;
  sessions: number;
  improved: boolean;
}

export interface JointTrendsResponse {
  joints: Record<string, JointDataPoint[]>;
  improvements: JointImprovement[];
}

export const jointTrends = {
  get: () =>
    request<JointTrendsResponse>("/analyses/joint-trends"),
};

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressRecord {
  id: string;
  title: string;
  sport: string;
  date: string;
  overallScore: number;
  techniqueScore?: number;
  powerScore?: number;
  balanceScore?: number;
  consistencyScore?: number;
  mobilityScore?: number;
  speedScore?: number;
}

export const progress = {
  list: () =>
    request<{ entries: ProgressRecord[] }>("/progress"),
};

// ─── Achievements ──────────────────────────────────────────────────────────────

export interface AchievementRecord {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  total: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export const achievements = {
  list: () =>
    request<{ achievements: AchievementRecord[] }>("/achievements"),
};

// ─── Subscriptions ─────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string | null;
  description: string;
  popular?: boolean;
  features: string[];
  limits: {
    analysesPerMonth: number;
    aiChat: boolean;
    proComparisons: boolean;
    priorityProcessing: boolean;
  };
}

export const subscriptions = {
  plans: () =>
    request<{ plans: Plan[] }>("/subscriptions/plans"),

  current: () =>
    request<{ subscription: SubscriptionRecord; plan: Plan }>(
      "/subscriptions/current"
    ),

  update: (tier: "free" | "pro" | "elite", revenueCatCustomerId?: string) =>
    request<{ subscription: SubscriptionRecord }>("/subscriptions/update", {
      method: "POST",
      body: JSON.stringify({ tier, revenueCatCustomerId }),
    }),
};
