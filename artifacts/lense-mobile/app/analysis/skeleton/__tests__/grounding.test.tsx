import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Dimensions } from "react-native";

// ─── Drive the mocks from per-test state ──────────────────────────────────────
// jest hoists jest.mock factories; vars they close over must be prefixed `mock`.
const mockApiGet = jest.fn();
const mockApiUpdate = jest.fn();

// Captured WebView onMessage handler so tests can push scan-engine events.
let webviewOnMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined;

jest.mock("@/lib/api", () => ({
  analyses: {
    get: (...args: any[]) => mockApiGet(...args),
    update: (...args: any[]) => mockApiUpdate(...args),
  },
  drills: {
    getCompleted: jest.fn(async () => ({ completedTipIds: [] })),
    markDone: jest.fn(async () => ({ success: true })),
    markUndone: jest.fn(async () => ({ success: true })),
  },
  jointTrends: {
    get: jest.fn(async () => ({ joints: {}, improvements: [] })),
  },
}));

jest.mock("@/utils/notifications", () => ({
  scheduleImprovementNotification: jest.fn(async () => {}),
}));

jest.mock("react-native-webview", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    WebView: ReactLocal.forwardRef((props: any, ref: any) => {
      ReactLocal.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      webviewOnMessage = props.onMessage;
      return ReactLocal.createElement(View, { testID: "pose-webview" });
    }),
  };
});

// The frozen viewer pulls in expo-image / react-native-svg / reanimated; the
// grounding lifecycle doesn't depend on the actual drawing, so stub it out.
jest.mock("@/components/FrozenSkeleton", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(View, { testID: "frozen-skeleton" }),
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

let mockParams: Record<string, string> = { id: "1" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { UTF8: "utf8" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => "file:///video.mp4"),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

import SkeletonScreen from "../[id]";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const groundedInjuryTip = {
  id: "g-inj",
  tipType: "injury",
  severity: "critical",
  category: "Knee Mechanics",
  title: "GROUNDED_INJURY_TIP",
  description: "Grounded in measured angles.",
  joints: ["leftKnee"],
};
const groundedPerfTip = {
  id: "g-perf",
  tipType: "performance",
  severity: "info",
  category: "Power Output",
  title: "GROUNDED_PERF_TIP",
  description: "Grounded performance coaching.",
  joints: ["leftKnee"],
};
const groundedTips = [groundedInjuryTip, groundedPerfTip];

function resp(grounded: boolean, tips: any[] = grounded ? groundedTips : []) {
  return {
    analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: grounded },
    tips,
    injuryRisks: [],
  };
}

function deferred() {
  let resolve!: (v: any) => void;
  let reject!: (e: any) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Flush pending microtasks (effect async work, resolved api promises). The
// hidden scanner only mounts after the html file + video uri resolve, so give
// the load/build effects a few rounds to settle.
async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

function emit(msg: any) {
  act(() => {
    webviewOnMessage?.({ nativeEvent: { data: JSON.stringify(msg) } });
  });
}

// New scanner protocol: a single scanComplete carries the measured angles,
// per-joint risk levels and the frozen frame used for the PATCH contract.
const scanMsg = {
  type: "scanComplete",
  time: 1.2,
  score: 2,
  angles: { leftKnee: 88, rightKnee: 90 },
  risks: { leftKnee: 2, rightKnee: 0, leftHip: 0, rightHip: 0, leftElbow: 0, rightElbow: 0 },
  frame: "frame-data",
};

// A per-joint frozen-frame capture streamed over the bridge during the scan.
const captureMsg = {
  type: "capture",
  capture: {
    id: "cap0",
    kind: "worst",
    time: 1.2,
    aspect: 0.6,
    frame: "data:image/jpeg;base64,zzz",
    lm: [{ x: 0.5, y: 0.5, v: 0.9 }],
    jr: { leftKnee: { deg: 88, lvl: 2 } },
    joints: ["leftKnee"],
    maxLvl: 2,
  },
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Dimensions, "get").mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 } as any);
  mockParams = { id: "1" };
  webviewOnMessage = undefined;
  mockApiGet.mockReset();
  mockApiUpdate.mockReset();
  mockApiUpdate.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("skeleton screen — grounding lifecycle", () => {
  it("surfaces grounded tips after a successful first scan + PATCH + poll", async () => {
    let grounded = false;
    mockApiGet.mockImplementation(() => Promise.resolve(resp(grounded)));

    render(<SkeletonScreen />);
    await flush();

    grounded = true; // server will report grounded on the next poll
    emit(scanMsg); // triggers runBiomechanics → PATCH → poll
    await flush();

    // Poll is scheduled 2000ms after the PATCH resolves.
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    expect(mockApiUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GROUNDED_INJURY_TIP")).toBeTruthy();
    expect(screen.getByText("GROUNDED_PERF_TIP")).toBeTruthy();
  });

  it("falls back to the measured card (never stale tips) when the PATCH fails", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false)));
    mockApiUpdate.mockRejectedValue(new Error("network"));

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    expect(screen.getByText("Review the flagged joints")).toBeTruthy();
    expect(screen.queryByText("GROUNDED_INJURY_TIP")).toBeNull();
  });

  it("falls back to the measured card when the poll never grounds (GET timeout)", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false))); // never grounds

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    // First poll at 2000ms, then up to 20 retries at 1800ms each.
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();
    for (let i = 0; i < 22; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { jest.advanceTimersByTime(1800); });
      // eslint-disable-next-line no-await-in-loop
      await flush(2);
    }

    expect(screen.getByText("Review the flagged joints")).toBeTruthy();
    expect(screen.queryByText("GROUNDED_INJURY_TIP")).toBeNull();
  });

  it("shows grounded tips immediately when revisiting an already-grounded analysis", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(true))); // loaded grounded

    render(<SkeletonScreen />);
    await flush();

    // Grounded tips render from the load-time grounded flag — no fresh scan
    // result is required (the re-scan only refreshes the frozen frames).
    expect(screen.getByText("GROUNDED_PERF_TIP")).toBeTruthy();
    expect(screen.getByText("GROUNDED_INJURY_TIP")).toBeTruthy();
  });

  it("never writes one analysis's grounded tips onto another after rapid id navigation", async () => {
    const pendingPoll = deferred();
    let id1GetCalls = 0;
    mockApiGet.mockImplementation((id: string) => {
      if (id === "1") {
        id1GetCalls += 1;
        if (id1GetCalls === 1) return Promise.resolve(resp(false)); // initial load
        return pendingPoll.promise; // poll stays in-flight across navigation
      }
      return Promise.resolve(resp(false)); // id "2" loads ungrounded
    });

    const { rerender } = render(<SkeletonScreen />);
    await flush();

    emit(scanMsg); // runBiomechanics for id "1"
    await flush();
    await act(async () => { jest.advanceTimersByTime(2000); }); // poll fires → in-flight GET
    await flush();

    // Navigate to a different analysis before the poll resolves.
    mockParams = { id: "2" };
    rerender(<SkeletonScreen />);
    await flush();

    // The stale poll for id "1" now resolves with grounded tips — it must be ignored.
    await act(async () => {
      pendingPoll.resolve({
        analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
        tips: [{ ...groundedInjuryTip, title: "ANALYSIS_ONE_TIP" }],
        injuryRisks: [],
      });
    });
    await flush();

    expect(screen.queryByText("ANALYSIS_ONE_TIP")).toBeNull();
  });

  it("accepts streamed frozen-frame captures without disrupting the grounding flow", async () => {
    let grounded = false;
    mockApiGet.mockImplementation(() => Promise.resolve(resp(grounded)));

    render(<SkeletonScreen />);
    await flush();

    // A capture streams in mid-scan and is retained.
    emit(captureMsg);
    await flush();

    // The scan still completes and grounds normally with captures present.
    grounded = true;
    emit(scanMsg);
    await flush();
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    expect(mockApiUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GROUNDED_INJURY_TIP")).toBeTruthy();
    // Once scanning ends the streamed capture drives the frozen hero viewer.
    expect(screen.getAllByTestId("frozen-skeleton").length).toBeGreaterThan(0);
  });

  it("never PATCHes empty biomechanics when the scan measured no pose", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false)));

    render(<SkeletonScreen />);
    await flush();

    // Model-load / video-decode failure: scanComplete with no measured angles.
    emit({
      type: "scanComplete",
      angles: {},
      risks: { leftKnee: 0, rightKnee: 0, leftHip: 0, rightHip: 0, leftElbow: 0, rightElbow: 0 },
      frame: "",
    });
    await flush();
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    // No measurement → never PATCH, never ground, never claim "all safe".
    expect(mockApiUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("GROUNDED_INJURY_TIP")).toBeNull();
    expect(screen.queryByText("No injury risks detected across the scan")).toBeNull();
    // The hero communicates the failure and offers re-selection instead.
    expect(screen.getByText("Couldn’t detect the athlete clearly")).toBeTruthy();
  });
});


// ─── improvement notifications ────────────────────────────────────────────────
// These tests verify that after a successful PATCH the skeleton screen calls
// scheduleImprovementNotification exactly when the server reports improvements,
// and skips the call when the improvements array is absent or empty.
describe("skeleton screen — improvement notifications", () => {
  function getNotifMock() {
    // Re-require so we get the jest.fn() registered by the jest.mock factory.
    const { scheduleImprovementNotification } = require("@/utils/notifications");
    return scheduleImprovementNotification as jest.Mock;
  }

  beforeEach(() => {
    getNotifMock().mockClear();
  });

  it("schedules a notification when the PATCH response includes improvements", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false)));
    mockApiUpdate.mockResolvedValue({
      success: true,
      improvements: [{ joint: "leftKnee", oldRisk: 2, newRisk: 1 }],
    });

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    expect(getNotifMock()).toHaveBeenCalledTimes(1);
    const [improvements, sport] = getNotifMock().mock.calls[0]!;
    expect(improvements).toEqual([{ joint: "leftKnee", oldRisk: 2, newRisk: 1 }]);
    expect(typeof sport).toBe("string");
  });

  it("does not schedule a notification when the PATCH response has no improvements", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false)));
    mockApiUpdate.mockResolvedValue({ success: true, improvements: [] });

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    expect(getNotifMock()).not.toHaveBeenCalled();
  });

  it("does not schedule a notification when improvements is absent from the PATCH response", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false)));
    mockApiUpdate.mockResolvedValue({ success: true });

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    expect(getNotifMock()).not.toHaveBeenCalled();
  });
});


// ─── askCoach — completed-drill context ───────────────────────────────────────
// These tests verify that when tips with drills have been marked as done, the
// pending chat message stored in AsyncStorage includes the completed-drill
// context so the AI Coach can acknowledge the work and suggest progressions.
describe("askCoach — completed-drill context in pending message", () => {
  const kneeInjuryTip = {
    id: "dt-knee",
    tipType: "injury",
    severity: "critical",
    category: "Knee Mechanics",
    title: "KNEE_VALGUS_TIP",
    description: "Knee is caving inward.",
    joints: ["leftKnee"],
    drill: { name: "Hip Hinge Drill", sets: "3", reps: "10", cue: "Push knees out" },
  };
  const hipPerfTip = {
    id: "dt-hip",
    tipType: "performance",
    severity: "info",
    category: "Power Output",
    title: "HIP_DRIVE_TIP",
    description: "Increase hip drive.",
    joints: ["leftHip"],
    drill: { name: "Tempo Squat", sets: "3", reps: "8", cue: "3-second descent" },
  };

  function drillResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      tips: [kneeInjuryTip, hipPerfTip],
      injuryRisks: [],
    };
  }

  function getSetItemCalls() {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return (AsyncStorage.setItem.mock.calls as [string, string][]).filter(
      ([key]) => key === "pendingChatMessage"
    );
  }

  beforeEach(() => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.setItem.mockClear();
  });

  it("includes other completed drill names when asking about a different tip", async () => {
    mockApiGet.mockResolvedValue(drillResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand knee tip and mark its drill as done
    fireEvent.press(screen.getByText("KNEE_VALGUS_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    // Expand hip tip and ask the coach about it
    fireEvent.press(screen.getByText("HIP_DRIVE_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getSetItemCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toContain("Hip Hinge Drill");
  });

  it("asks for a progression when the current tip drill is already done", async () => {
    mockApiGet.mockResolvedValue(drillResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand knee tip, mark done, then ask coach about the same tip
    fireEvent.press(screen.getByText("KNEE_VALGUS_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Mark done"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getSetItemCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toContain("already completed this drill");
    expect(calls[0]![1]).toContain("progression");
  });

  it("omits completed-drill context when no drills have been marked done", async () => {
    mockApiGet.mockResolvedValue(drillResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand knee tip and ask coach without marking anything done
    fireEvent.press(screen.getByText("KNEE_VALGUS_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getSetItemCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).not.toContain("completed");
  });
});

// ─── askCoach — conflict warning in pending message ───────────────────────────
// These tests verify that when a performance tip shares a joint with an open
// injury tip, the pre-fill message stored in AsyncStorage includes the warning
// "Note: there is an open injury risk on this joint — please address that first."
// and that the warning is absent for non-conflicted performance tips and for
// injury tips (even when their joint is involved in a conflict).
describe("askCoach — conflict warning in pending message", () => {
  // Injury tip on leftKnee + performance tip on leftKnee → conflict on leftKnee
  const conflictInjuryTip = {
    id: "cw-inj",
    tipType: "injury",
    severity: "warning",
    category: "Knee Mechanics",
    title: "CONFLICT_INJURY_TIP",
    description: "Knee is under load.",
    joints: ["leftKnee"],
  };
  const conflictPerfTip = {
    id: "cw-perf",
    tipType: "performance",
    severity: "info",
    category: "Power Output",
    title: "CONFLICT_PERF_TIP",
    description: "Increase knee drive.",
    joints: ["leftKnee"],
  };
  // Performance tip on a different joint (rightHip) — no conflict
  const safeHipPerfTip = {
    id: "cw-safe",
    tipType: "performance",
    severity: "info",
    category: "Hip Drive",
    title: "SAFE_HIP_PERF_TIP",
    description: "Drive through the hips.",
    joints: ["rightHip"],
  };

  function conflictResp(tips: any[] = [conflictInjuryTip, conflictPerfTip, safeHipPerfTip]) {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      tips,
      injuryRisks: [],
    };
  }

  function getPendingChatCalls() {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return (AsyncStorage.setItem.mock.calls as [string, string][]).filter(
      ([key]) => key === "pendingChatMessage"
    );
  }

  beforeEach(() => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.setItem.mockClear();
  });

  it("prepends the conflict warning when asking coach about a conflicted performance tip", async () => {
    mockApiGet.mockResolvedValue(conflictResp());

    render(<SkeletonScreen />);
    await flush();

    fireEvent.press(screen.getByText("CONFLICT_PERF_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getPendingChatCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toContain(
      "Note: there is an open injury risk on this joint — please address that first."
    );
  });

  it("does NOT prepend the conflict warning when the performance tip has no conflicted joint", async () => {
    mockApiGet.mockResolvedValue(conflictResp());

    render(<SkeletonScreen />);
    await flush();

    fireEvent.press(screen.getByText("SAFE_HIP_PERF_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getPendingChatCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).not.toContain("open injury risk");
  });

  it("does NOT prepend the conflict warning when asking coach about an injury tip (even on a conflicted joint)", async () => {
    mockApiGet.mockResolvedValue(conflictResp());

    render(<SkeletonScreen />);
    await flush();

    fireEvent.press(screen.getByText("CONFLICT_INJURY_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Ask Coach about this"));
    await flush();

    const calls = getPendingChatCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).not.toContain("open injury risk");
  });
});

// ─── Joint history sheet — delta badge interaction ────────────────────────────
// These tests verify that tapping a tappable delta badge opens the
// JointHistorySheet for the correct joint, and that the sheet is absent when
// no trend data exists.
describe("joint history sheet — delta badge interaction", () => {
  // Two sorted entries for leftKnee: analysis "0" is the previous session,
  // analysis "1" is the current one. The component sorts by date then looks
  // one slot back from the current id to derive prevAngles.
  const trendsWithHistory = {
    joints: {
      leftKnee: [
        { analysisId: "0", date: "2026-06-01T00:00:00.000Z", angle: 80, risk: 1 },
        { analysisId: "1", date: "2026-06-19T00:00:00.000Z", angle: 88, risk: 2 },
      ],
    },
    improvements: [],
  };

  let mockJointTrendsGet: jest.Mock;

  beforeEach(() => {
    const api = require("@/lib/api");
    mockJointTrendsGet = api.jointTrends.get as jest.Mock;
    mockJointTrendsGet.mockReset();
  });

  it("tapping a tappable delta badge opens the history sheet for the correct joint", async () => {
    mockApiGet.mockResolvedValue(resp(true));
    mockJointTrendsGet.mockResolvedValue(trendsWithHistory);

    render(<SkeletonScreen />);
    await flush();

    // Emit a scan result so scanResult.angles.leftKnee = 88 — required for the
    // delta badge to compute a non-null value to render.
    emit(scanMsg);
    await flush();

    // Let the PATCH + poll round settle (2 s poll delay).
    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    // prevAngles.leftKnee = 80, currentDeg = 88 → delta = +8°.
    // hasHistory = true (trendsWithHistory.joints.leftKnee.length > 0) →
    // badge is a tappable TouchableOpacity.
    // Both tips share leftKnee so two badges render — press the first one.
    // The handler calls e.stopPropagation(), so we must supply that method.
    fireEvent.press(screen.getAllByText("+8°")[0]!, { stopPropagation: jest.fn() });
    await flush();

    // JointHistorySheet renders with "Left Knee" as its header label
    // (JOINT_HISTORY_DISPLAY["leftKnee"] = "Left Knee", which is distinct from
    // the chip label JOINT_LABEL["leftKnee"] = "L Knee").
    expect(screen.getByText("Left Knee")).toBeTruthy();
  });

  it("does not render the history sheet when no trend data exists for the joint", async () => {
    mockApiGet.mockResolvedValue(resp(true));
    mockJointTrendsGet.mockResolvedValue({ joints: {}, improvements: [] });

    render(<SkeletonScreen />);
    await flush();

    // Emit scan result — even with scanResult set, prevAngles is empty so
    // renderDeltaBadge returns null (no previous angle to compare against),
    // meaning there is no tappable badge and historyJoint is never set.
    emit(scanMsg);
    await flush();

    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    // The JointHistorySheet header label "Left Knee" must not appear anywhere.
    expect(screen.queryByText("Left Knee")).toBeNull();
  });

  it("tapping the backdrop does not close the history sheet", async () => {
    mockApiGet.mockResolvedValue(resp(true));
    mockJointTrendsGet.mockResolvedValue(trendsWithHistory);

    render(<SkeletonScreen />);
    await flush();

    emit(scanMsg);
    await flush();

    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    // Open the sheet by tapping the delta badge.
    fireEvent.press(screen.getAllByText("+8°")[0]!, { stopPropagation: jest.fn() });
    await flush();

    // Sheet is open — header label is visible.
    expect(screen.getByText("Left Knee")).toBeTruthy();

    // Tap the backdrop (outer Pressable); the sheet must remain open.
    fireEvent.press(screen.getByTestId("history-sheet-backdrop"));
    await flush();

    expect(screen.getByText("Left Knee")).toBeTruthy();
  });
});

// ─── Scan quality banner ───────────────────────────────────────────────────────
// KEY_LANDMARKS indices: [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
// Max index is 28 → landmark array needs ≥ 29 entries.
// computeScanQuality averages `v` across those indices:
//   avg < 0.45  → "low"   (dismissible banner)
//   avg < 0.70  → "medium" (inline note, no banner)
//   avg ≥ 0.70  → "high"  (no warning)
function makeLandmarks(v: number) {
  return Array.from({ length: 29 }, () => ({ x: 0.5, y: 0.5, v }));
}

describe("scan quality banner — low/medium confidence UI", () => {
  function qualityCapture(v: number, kind: "worst" | "joint" | "clear" = "worst") {
    return {
      type: "capture",
      capture: {
        id: "qcap0",
        kind,
        time: 1.0,
        aspect: 0.6,
        frame: "data:image/jpeg;base64,zzz",
        lm: makeLandmarks(v),
        jr: { leftKnee: { deg: 88, lvl: 1 } },
        joints: ["leftKnee"],
        maxLvl: 1,
      },
    };
  }

  it("shows the low-confidence banner and 'Re-select athlete' link when avg visibility < 0.45", async () => {
    mockApiGet.mockResolvedValue(resp(false));

    render(<SkeletonScreen />);
    await flush();

    emit(qualityCapture(0.3));  // avg = 0.3 → "low"
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText("Athlete not clearly visible")).toBeTruthy();
    expect(screen.getByText("Re-select athlete →")).toBeTruthy();
  });

  it("dismisses the low-confidence banner when the × button is pressed", async () => {
    mockApiGet.mockResolvedValue(resp(false));

    render(<SkeletonScreen />);
    await flush();

    emit(qualityCapture(0.3));
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText("Athlete not clearly visible")).toBeTruthy();

    fireEvent.press(screen.getByTestId("scan-quality-banner-dismiss"));
    await flush();

    expect(screen.queryByText("Athlete not clearly visible")).toBeNull();
  });

  it("shows the medium-confidence inline note (no banner) when avg visibility is 0.45–0.70", async () => {
    mockApiGet.mockResolvedValue(resp(false));

    render(<SkeletonScreen />);
    await flush();

    emit(qualityCapture(0.55));  // avg = 0.55 → "medium"
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText(/Some joints weren't fully visible/)).toBeTruthy();
    expect(screen.queryByText("Athlete not clearly visible")).toBeNull();
  });
});

// ─── Completed-drills cleared on re-scan ─────────────────────────────────────
// When the poll detects biomechanicsApplied=true after a re-scan, the screen
// must remove the persisted drill_done_<id> key from AsyncStorage and reset
// completedDrills to empty so stale "Completed" badges never survive into
// the freshly-grounded session.
describe("completed-drills cleared when re-scan grounds new tips", () => {
  const drillTip = {
    id: "cd-knee",
    tipType: "injury" as const,
    severity: "critical",
    category: "Knee Mechanics",
    title: "CLEARABLE_DRILL_TIP",
    description: "Knee caving — fix form.",
    joints: ["leftKnee"],
    drill: { name: "Wall Squat", sets: "3", reps: "10", cue: "Track knees over toes" },
  };

  function drillResp(grounded: boolean) {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: grounded },
      tips: [drillTip],
      injuryRisks: [],
    };
  }

  beforeEach(() => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    // Distinguish video URI lookup from the pre-populated drill completion list.
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === "video_uri_1") return "file:///video.mp4";
      if (key === "drill_done_1") return JSON.stringify(["cd-knee"]);
      return null;
    });
    AsyncStorage.removeItem.mockClear();
    AsyncStorage.setItem.mockClear();
  });

  afterEach(() => {
    // Restore the default getItem behaviour so other describe blocks are unaffected.
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem.mockReset();
    AsyncStorage.getItem.mockImplementation(async () => "file:///video.mp4");
  });

  it("calls AsyncStorage.removeItem for drill_done_<id> when biomechanicsApplied flips true", async () => {
    let grounded = false;
    mockApiGet.mockImplementation(() => Promise.resolve(drillResp(grounded)));

    render(<SkeletonScreen />);
    await flush();

    // Trigger the scan → PATCH → poll cycle.
    grounded = true; // server will report grounded on the next poll
    emit(scanMsg);
    await flush();

    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("drill_done_1");
  });

  it("resets completedDrills to empty so the drill button shows 'Mark done' after re-scan", async () => {
    let grounded = false;
    mockApiGet.mockImplementation(() => Promise.resolve(drillResp(grounded)));

    render(<SkeletonScreen />);
    await flush();

    // Before the scan: tips are not yet grounded (groundedReady=false), but
    // completedDrills is already loaded from AsyncStorage with "cd-knee" in it.
    // Trigger scan → grounds tips → clears completedDrills.
    grounded = true;
    emit(scanMsg);
    await flush();

    await act(async () => { jest.advanceTimersByTime(2000); });
    await flush();

    // Tips are now visible (groundedReady=true). Expand the tip to reach the
    // drill action button and confirm it reads "Mark done", not "Completed".
    fireEvent.press(screen.getByText("CLEARABLE_DRILL_TIP"));
    await flush();

    expect(screen.getByText("Mark done")).toBeTruthy();
    expect(screen.queryByText("Completed")).toBeNull();
  });
});
