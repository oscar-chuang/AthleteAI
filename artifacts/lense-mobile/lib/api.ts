import AsyncStorage from "@react-native-async-storage/async-storage";

function resolveApiUrl(): string {
  // On web (browser), dynamically use the same hostname on port 8080 (the API
  // server's external port in the Replit proxy). This avoids the dead
  // localhost:3001 fallback that only reaches the Expo dev server itself.
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8080/api`;
  }
  // Native: use the configured env var or fall back to the local API port.
  return (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080") + "/api";
}

const API_URL = resolveApiUrl();

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

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000
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
  weeklyProgress: number;
  streakDays: number;
  trainingDays?: number[];
  checkInHour?: number;
  avatarUrl?: string | null;
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
  uploadedAt: string;
  jointAngles?: Record<string, number>;
  jointRisks?: Record<string, number>;
}

/** Per-joint improvement delta between two analyses. */
export interface JointImprovement {
  joint: string;
  deltaDeg: number;
  improved: boolean;
}

export interface TipRecord {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  drill?: string;
  tipType?: "injury" | "performance";
}

export interface RiskRecord {
  id: string;
  joint: string;
  riskPercent: number;
  description: string;
  prevention: string;
}

// ─── Live analysis types ───────────────────────────────────────────────────────

export type JointKey = string;

/** One captured pose frame from the skeleton overlay. */
export interface FrameTick {
  t: number;
  /** Mediapipe landmark array — x/y in [0,1] normalised coords, v = visibility. */
  lm: Array<{ x: number; y: number; v: number }>;
  /** Per-joint angle in degrees, keyed by joint name. */
  angles: Record<JointKey, number>;
  /** Per-joint risk data: deg = angle, lvl = risk level (0/1/2). */
  jr: Record<JointKey, { deg: number; lvl: number; risk?: number }>;
}

/** Aggregated stats across all FrameTicks for an analysis session. */
export interface TickStats {
  joints: Record<string, { avgAngle: number; maxRisk: number; timesFlag: number }>;
  totalTicks: number;
  duration: number;
}

/** A timestamped pose risk event surfaced to the coaching-moments endpoint. */
export interface FlaggedMoment {
  t: number;
  joints: JointKey[];
  angles: Partial<Record<JointKey, number>>;
  risks: Partial<Record<JointKey, number>>;
}

/** A coaching cue generated by the AI for a specific moment in the analysis. */
export interface CoachingMoment {
  timestamp: number;
  /** Joint names (plain strings) associated with this coaching moment. */
  joints: string[];
  whatWeNoticed?: string;
  whyItMatters?: string;
  suggestedFix?: string;
  /** AI confidence score in [0, 1]. */
  confidence: number;
  confidenceNote?: string;
  /** Supporting evidence for the coaching observation. */
  evidence: { joint?: string; angle?: number; timestamp?: number };
  message?: string;
}

/** High-level AI movement summary returned after a live session. */
export interface MovementSummary {
  overallScore: number;
  flowScore: number;
  efficiencyScore: number;
  bodyControlScore: number;
  consistencyScore: number;
  rhythmScore: number;
  coachSummary: string;
  mostImportantFix: string;
  topStrengths: string[];
  topImprovements: string[];
}

/** Historical joint angle data point for the JointHistorySheet chart. */
export interface JointDataPoint {
  date: string;
  angle: number;
  risk: number;
  sport: string;
  analysisId?: string;
}

/** Historical movement dimension data point for MovementDimensionHistorySheet. */
export interface MovementSummaryDataPoint {
  date: string;
  sport: string;
  analysisId?: string;
  flowScore?: number;
  efficiencyScore?: number;
  bodyControlScore?: number;
  consistencyScore?: number;
  rhythmScore?: number;
  overallScore?: number;
}

/** A structured drill recommendation associated with a coaching tip. */
export interface DrillRecord {
  id?: string;
  name: string;
  sets: string | number;
  reps: string | number;
  cue?: string;
  description?: string;
}

/** Per-joint trend data returned by the joint-trends endpoint. */
export interface JointTrendPoint {
  date: string;
  angle: number;
  risk: number;
  sport: string;
  analysisId?: string;
}

export interface JointTrendsResponse {
  joints: Record<string, JointTrendPoint[]>;
}

/** Aggregated profile stats returned by the /profile/stats endpoint. */
export interface ProfileStats {
  thisWeekCount: number;
  totalCount: number;
  avgScore: number;
  streak?: number;
  weeklyGoal?: number;
  [key: string]: unknown;
}

/** A sport entry returned by /progress/sports. */
export interface SportEntry {
  sport: string;
  count: number;
}

/** A personal record entry for a specific metric. */
export interface PersonalRecordEntry {
  value: number;
  date: string;
  analysisId?: string;
  [key: string]: unknown;
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

  delete: (id: string) =>
    request<{ success: boolean }>(`/analyses/${id}`, { method: "DELETE" }),

  update: (id: string, data: { sport?: string; movementType?: string; [key: string]: unknown }) =>
    request<{ analysis: AnalysisRecord }>(`/analyses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  detectSport: (imageBase64: string) =>
    request<{ sport: string; movementType: string }>("/analyses/detect-sport", {
      method: "POST",
      body: JSON.stringify({ imageBase64 }),
    }),

  coachingMoments: (id: string, flagged: FlaggedMoment[]) =>
    request<{ moments: CoachingMoment[] }>(`/analyses/${id}/coaching-moments`, {
      method: "POST",
      body: JSON.stringify({ flagged }),
    }),

  movementSummary: (id: string, tickStats?: TickStats) =>
    request<{ summary: MovementSummary }>(`/analyses/${id}/movement-summary`, {
      method: "POST",
      body: JSON.stringify({ tickStats }),
    }),
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
    }),

  clear: () => request<{ success: boolean }>("/chat", { method: "DELETE" }),
};

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressRecord {
  id: string;
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

  sports: () =>
    request<{ sports: SportEntry[] }>("/progress/sports"),

  personalRecords: (sport: string) =>
    request<{ records: Record<string, PersonalRecordEntry> }>(`/progress/personal-records?sport=${encodeURIComponent(sport)}`),

  summary: (sport: string, movementType?: string) =>
    request<{ summary: string }>("/progress/summary", {
      method: "POST",
      body: JSON.stringify({ sport, movementType }),
    }),
};

// ─── Joint Trends ─────────────────────────────────────────────────────────────

export const jointTrends = {
  get: () =>
    request<JointTrendsResponse>("/joint-trends"),
};

// ─── Movement Summary History ──────────────────────────────────────────────────

export const movementSummaryHistory = {
  get: () =>
    request<{ history: MovementSummaryDataPoint[] }>("/movement-summary-history"),
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
