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

// ─── 'What's next?' progression card ─────────────────────────────────────────
// These tests verify that after a drill is marked done the "WHAT'S NEXT?"
// card appears with the correct progression cue, and that tapping
// "Ask Coach to plan my progression" stores the right pending chat message.
describe("'What's next?' card — appears after marking drill done", () => {
  const nextTip = {
    id: "nx-knee",
    tipType: "injury" as const,
    severity: "warning",
    category: "Knee Mechanics",
    title: "NEXT_STEP_TIP",
    description: "Fix knee valgus.",
    joints: ["leftKnee"],
    drill: { name: "Hip Hinge Drill", sets: "3", reps: "10", cue: "Push knees out" },
  };

  function nextResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      tips: [nextTip],
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

  it("shows the WHAT'S NEXT? label after tapping Mark done", async () => {
    mockApiGet.mockResolvedValue(nextResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand the tip
    fireEvent.press(screen.getByText("NEXT_STEP_TIP"));
    await flush();

    // Card is absent before marking done
    expect(screen.queryByText("WHAT'S NEXT?")).toBeNull();

    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    expect(screen.getByText("WHAT'S NEXT?")).toBeTruthy();
  });

  it("shows the correct +1 set progression cue after marking done", async () => {
    mockApiGet.mockResolvedValue(nextResp());

    render(<SkeletonScreen />);
    await flush();

    fireEvent.press(screen.getByText("NEXT_STEP_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    // drill.sets = "3" → injury kind → "Progress to 4 sets, or slow the eccentric…"
    expect(screen.getByText(/Progress to 4 sets/)).toBeTruthy();
  });

  it("stores the progression pending message when 'Ask Coach to plan my progression' is tapped", async () => {
    mockApiGet.mockResolvedValue(nextResp());

    render(<SkeletonScreen />);
    await flush();

    fireEvent.press(screen.getByText("NEXT_STEP_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    fireEvent.press(screen.getByText("Ask Coach to plan my progression"));
    await flush();

    const calls = getPendingChatCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toContain("already completed this drill");
    expect(calls[0]![1]).toContain("progression");
  });

  it("hides the WHAT'S NEXT? card after tapping Completed to toggle back to undone", async () => {
    mockApiGet.mockResolvedValue(nextResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand the tip
    fireEvent.press(screen.getByText("NEXT_STEP_TIP"));
    await flush();

    // Mark the drill as done — card must appear
    fireEvent.press(screen.getByText("Mark done"));
    await flush();
    expect(screen.getByText("WHAT'S NEXT?")).toBeTruthy();

    // Toggle back to undone — card must disappear
    fireEvent.press(screen.getByText("Completed"));
    await flush();
    expect(screen.queryByText("WHAT'S NEXT?")).toBeNull();
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

  it("shows the 'High confidence' badge and hides both warning UIs when avg visibility ≥ 0.70", async () => {
    mockApiGet.mockResolvedValue(resp(false));

    render(<SkeletonScreen />);
    await flush();

    emit(qualityCapture(0.9));  // avg = 0.9 → "high"
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText("High confidence")).toBeTruthy();
    expect(screen.queryByText("Athlete not clearly visible")).toBeNull();
    expect(screen.queryByText(/Some joints weren't fully visible/)).toBeNull();
  });

  it("updates badge to 'High confidence' and removes the low-confidence banner after re-scan", async () => {
    mockApiGet.mockResolvedValue(resp(false));

    render(<SkeletonScreen />);
    await flush();

    // First scan: low-confidence capture (avg = 0.3 → "low") triggers the warning banner.
    // Use a distinct id so the dedup check in setCaptures doesn't drop the second capture.
    emit(qualityCapture(0.3));
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText("Athlete not clearly visible")).toBeTruthy();
    expect(screen.queryByText("High confidence")).toBeNull();

    // Second scan: high-confidence capture with a distinct id ("qcap1") so it passes the
    // dedup guard in setCaptures and the component updates the hero via the worst-frame path.
    emit({ ...qualityCapture(0.9), capture: { ...qualityCapture(0.9).capture, id: "qcap1" } });
    await flush();
    emit(scanMsg);
    await flush();

    expect(screen.getByText("High confidence")).toBeTruthy();
    expect(screen.queryByText("Athlete not clearly visible")).toBeNull();
  });
});

// ─── Completed-drills — server-side persistence ───────────────────────────────
// These tests verify that on mount the screen calls drills.getCompleted and
// merges the server result with any locally-cached AsyncStorage set, and that
// toggling a drill done/undone fires the correct API method.
describe("completed drills — server-side persistence", () => {
  const rcTip = {
    id: "rc-knee",
    tipType: "injury" as const,
    severity: "warning",
    category: "Knee Mechanics",
    title: "RC_DRILL_TIP",
    description: "Knee caving — fix form.",
    joints: ["leftKnee"],
    drill: { name: "Hip Hinge Drill", sets: "3", reps: "10", cue: "Push knees out" },
  };

  function rcResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      tips: [rcTip],
      injuryRisks: [],
    };
  }

  function getDrillsMock() {
    const api = require("@/lib/api");
    return api.drills as {
      getCompleted: jest.Mock;
      markDone: jest.Mock;
      markUndone: jest.Mock;
    };
  }

  beforeEach(() => {
    const d = getDrillsMock();
    d.getCompleted.mockReset();
    d.markDone.mockReset();
    d.markUndone.mockReset();
    d.markDone.mockResolvedValue({ success: true });
    d.markUndone.mockResolvedValue({ success: true });

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem.mockReset();
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === "video_uri_1") return "file:///video.mp4";
      return null;
    });
    AsyncStorage.setItem.mockClear();
    AsyncStorage.removeItem.mockClear();
  });

  afterEach(() => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem.mockReset();
    AsyncStorage.getItem.mockImplementation(async () => "file:///video.mp4");
  });

  it("shows the Done badge when drills.getCompleted returns the tipId and AsyncStorage has no entry", async () => {
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: ["rc-knee"] });
    mockApiGet.mockResolvedValue(rcResp());

    render(<SkeletonScreen />);
    await flush();

    // The "Done" badge lives in the collapsed tip header — no expand needed.
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("shows the Done badge when AsyncStorage has the tipId and drills.getCompleted returns empty", async () => {
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: [] });
    mockApiGet.mockResolvedValue(rcResp());

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === "video_uri_1") return "file:///video.mp4";
      if (key === "drill_done_1") return JSON.stringify(["rc-knee"]);
      return null;
    });

    render(<SkeletonScreen />);
    await flush();

    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("Done badge survives screen unmount + remount (cross-session memory)", async () => {
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: [] });
    mockApiGet.mockResolvedValue(rcResp());

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;

    const { unmount } = render(<SkeletonScreen />);
    await flush();

    // Expand the tip and mark the drill done — writes drill_done_1 to AsyncStorage.
    fireEvent.press(screen.getByText("RC_DRILL_TIP"));
    await flush();
    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    // Capture what was written so the remounted screen sees it.
    const setItemCalls: [string, string][] = AsyncStorage.setItem.mock.calls;
    const drillDoneCall = setItemCalls.find(([k]) => k === "drill_done_1");
    expect(drillDoneCall).toBeDefined();
    const storedValue = drillDoneCall![1];

    // Simulate the user leaving the screen (unmount) then returning (remount).
    unmount();

    // Wire the next getItem to return the persisted drill_done_1 entry.
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === "video_uri_1") return "file:///video.mp4";
      if (key === "drill_done_1") return storedValue;
      return null;
    });
    // Server has no completed records — badge must come from AsyncStorage alone.
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: [] });

    render(<SkeletonScreen />);
    await flush();

    // Done badge must be visible in the collapsed tip header without any interaction.
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("calls drills.markDone with the correct tipId and drillName when toggling a drill done", async () => {
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: [] });
    mockApiGet.mockResolvedValue(rcResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand the tip to reach the Mark done button.
    fireEvent.press(screen.getByText("RC_DRILL_TIP"));
    await flush();

    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    const { markDone } = getDrillsMock();
    expect(markDone).toHaveBeenCalledTimes(1);
    expect(markDone).toHaveBeenCalledWith("1", "rc-knee", "Hip Hinge Drill");
  });

  it("calls drills.markUndone with the correct tipId when toggling a completed drill off", async () => {
    getDrillsMock().getCompleted.mockResolvedValue({ completedTipIds: [] });
    mockApiGet.mockResolvedValue(rcResp());

    render(<SkeletonScreen />);
    await flush();

    // Expand, mark done, then undo.
    fireEvent.press(screen.getByText("RC_DRILL_TIP"));
    await flush();

    fireEvent.press(screen.getByText("Mark done"));
    await flush();

    // Button text flips to "Completed"; pressing it again undoes.
    fireEvent.press(screen.getByText("Completed"));
    await flush();

    const { markDone, markUndone } = getDrillsMock();
    expect(markDone).toHaveBeenCalledTimes(1);
    expect(markUndone).toHaveBeenCalledTimes(1);
    expect(markUndone).toHaveBeenCalledWith("1", "rc-knee");
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

// ─── Group dividers — priority vs non-priority tips ───────────────────────────
// These tests verify that horizontal group-divider labels ("ADDITIONAL TIPS"
// in the injury section and "AFTER INJURY RECOVERY" in the performance section)
// appear only when there is at least one conflicted tip alongside at least one
// non-conflicted tip in the same section, and stay absent otherwise.
describe("group dividers — appear between priority and non-priority tips when conflicts exist", () => {
  // Shared joint (leftKnee) → conflict between injConflict and perfConflict.
  const injConflict = {
    id: "gd-inj-conflict",
    tipType: "injury",
    severity: "warning",
    category: "Knee Mechanics",
    title: "GD_INJURY_CONFLICT",
    description: "Knee load conflict.",
    joints: ["leftKnee"],
  };
  // Non-conflicted injury tip on a different joint (leftHip → no perf tip there).
  const injSafe = {
    id: "gd-inj-safe",
    tipType: "injury",
    severity: "info",
    category: "Hip Mechanics",
    title: "GD_INJURY_SAFE",
    description: "Hip alignment.",
    joints: ["leftHip"],
  };
  // Conflicted performance tip (also leftKnee → conflicts with injConflict).
  const perfConflict = {
    id: "gd-perf-conflict",
    tipType: "performance",
    severity: "info",
    category: "Power Output",
    title: "GD_PERF_CONFLICT",
    description: "Knee drive (conflicted).",
    joints: ["leftKnee"],
  };
  // Non-conflicted performance tip on a different joint.
  const perfSafe = {
    id: "gd-perf-safe",
    tipType: "performance",
    severity: "info",
    category: "Hip Drive",
    title: "GD_PERF_SAFE",
    description: "Drive through the hips.",
    joints: ["rightHip"],
  };

  function mixedResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      tips: [injConflict, injSafe, perfConflict, perfSafe],
      injuryRisks: [],
    };
  }

  function noConflictResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      // All injury tips on joints that have no matching performance tip.
      tips: [
        { ...injSafe, id: "nc-inj-1" },
        { ...perfSafe, id: "nc-perf-1" },
      ],
      injuryRisks: [],
    };
  }

  it("shows 'ADDITIONAL TIPS' in the injury section when conflicts exist", async () => {
    mockApiGet.mockResolvedValue(mixedResp());

    render(<SkeletonScreen />);
    await flush();

    expect(screen.getByText("ADDITIONAL TIPS")).toBeTruthy();
  });

  it("shows 'AFTER INJURY RECOVERY' in the performance section when conflicts exist", async () => {
    mockApiGet.mockResolvedValue(mixedResp());

    render(<SkeletonScreen />);
    await flush();

    expect(screen.getByText("AFTER INJURY RECOVERY")).toBeTruthy();
  });

  it("hides both dividers when there are no conflicted tips", async () => {
    mockApiGet.mockResolvedValue(noConflictResp());

    render(<SkeletonScreen />);
    await flush();

    expect(screen.queryByText("ADDITIONAL TIPS")).toBeNull();
    expect(screen.queryByText("AFTER INJURY RECOVERY")).toBeNull();
  });

  it("hides 'ADDITIONAL TIPS' when all injury tips are on conflicted joints (no non-priority group)", async () => {
    mockApiGet.mockResolvedValue({
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      // Only one injury tip and it is conflicted — no second group to divide.
      tips: [injConflict, perfConflict],
      injuryRisks: [],
    });

    render(<SkeletonScreen />);
    await flush();

    expect(screen.queryByText("ADDITIONAL TIPS")).toBeNull();
  });

  it("hides 'AFTER INJURY RECOVERY' when all performance tips are on conflicted joints (no non-priority group)", async () => {
    mockApiGet.mockResolvedValue({
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      // Only one performance tip and it is conflicted — no second group to divide.
      tips: [injConflict, perfConflict],
      injuryRisks: [],
    });

    render(<SkeletonScreen />);
    await flush();

    expect(screen.queryByText("AFTER INJURY RECOVERY")).toBeNull();
  });

  it("hides both dividers when only injury tips are present (no performance section to create a conflict)", async () => {
    mockApiGet.mockResolvedValue({
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      // Only injury tips — without any performance tip on leftKnee there is no
      // cross-section conflict, so no priority group forms and no divider is needed.
      tips: [injConflict, injSafe],
      injuryRisks: [],
    });

    render(<SkeletonScreen />);
    await flush();

    expect(screen.queryByText("ADDITIONAL TIPS")).toBeNull();
    expect(screen.queryByText("AFTER INJURY RECOVERY")).toBeNull();
  });

  it("hides both dividers when only performance tips are present (no injury section to create a conflict)", async () => {
    mockApiGet.mockResolvedValue({
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: true },
      // Only performance tips — without any injury tip on leftKnee there is no
      // cross-section conflict, so no priority group forms and no divider is needed.
      tips: [perfConflict, perfSafe],
      injuryRisks: [],
    });

    render(<SkeletonScreen />);
    await flush();

    expect(screen.queryByText("ADDITIONAL TIPS")).toBeNull();
    expect(screen.queryByText("AFTER INJURY RECOVERY")).toBeNull();
  });
});


// ─── 'Preparing scan…' placeholder lifecycle ──────────────────────────────────
// Before the WebView's ResizeObserver fires and posts a `layoutReady` message,
// the progress overlay must show "Preparing scan…" / "Waiting for first frame…".
// After the message arrives, the overlay must switch to "Tracking your movement"
// and "% — measuring joints".  Both portrait and landscape aspect ratios are
// covered by emitting a `meta` message first to set videoAspect.
describe("scan-overlay — 'Preparing scan…' placeholder lifecycle", () => {
  function ungroundedResp() {
    return {
      analysis: { id: 1, sport: "weightlifting", biomechanicsApplied: false },
      tips: [],
      injuryRisks: [],
    };
  }

  it("shows 'Preparing scan…' before any WebView message is received", async () => {
    mockApiGet.mockResolvedValue(ungroundedResp());

    render(<SkeletonScreen />);
    await flush();

    expect(screen.getByText("Preparing scan…")).toBeTruthy();
    expect(screen.getByText("Waiting for first frame…")).toBeTruthy();
    expect(screen.queryByText("Tracking your movement")).toBeNull();
    expect(screen.queryByText(/measuring joints/)).toBeNull();
  });

  it("replaces 'Preparing scan…' with progress text after layoutReady in portrait", async () => {
    mockApiGet.mockResolvedValue(ungroundedResp());

    render(<SkeletonScreen />);
    await flush();

    // Portrait aspect (taller than wide)
    emit({ type: "meta", vw: 9, vh: 16 });
    await flush();

    expect(screen.getByText("Preparing scan…")).toBeTruthy();

    emit({ type: "layoutReady" });
    await flush();

    expect(screen.queryByText("Preparing scan…")).toBeNull();
    expect(screen.queryByText("Waiting for first frame…")).toBeNull();
    expect(screen.getByText("Tracking your movement")).toBeTruthy();
    expect(screen.getByText(/measuring joints/)).toBeTruthy();
  });

  it("replaces 'Preparing scan…' with progress text after layoutReady in landscape", async () => {
    mockApiGet.mockResolvedValue(ungroundedResp());

    render(<SkeletonScreen />);
    await flush();

    // Landscape aspect (wider than tall)
    emit({ type: "meta", vw: 16, vh: 9 });
    await flush();

    expect(screen.getByText("Preparing scan…")).toBeTruthy();

    emit({ type: "layoutReady" });
    await flush();

    expect(screen.queryByText("Preparing scan…")).toBeNull();
    expect(screen.queryByText("Waiting for first frame…")).toBeNull();
    expect(screen.getByText("Tracking your movement")).toBeTruthy();
    expect(screen.getByText(/measuring joints/)).toBeTruthy();
  });

  it("removes the entire progress overlay after scanComplete", async () => {
    mockApiGet.mockResolvedValue(ungroundedResp());

    render(<SkeletonScreen />);
    await flush();

    // Reach the active-progress state: overlay should show "Tracking your movement".
    emit({ type: "layoutReady" });
    await flush();
    expect(screen.getByText("Tracking your movement")).toBeTruthy();

    // Scan finishes — the entire overlay (title + bar + sub-text) must disappear.
    emit(scanMsg);
    await flush();

    expect(screen.queryByText("Tracking your movement")).toBeNull();
  });
});
