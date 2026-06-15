import React from "react";
import { render, act, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";

// ─── Drive the mocks from per-test state ──────────────────────────────────────
// jest hoists jest.mock factories; vars they close over must be prefixed `mock`.
const mockApiGet = jest.fn();
const mockApiUpdate = jest.fn();

// Captured WebView onMessage handler so tests can push pose-engine events.
let webviewOnMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined;

jest.mock("@/lib/api", () => ({
  analyses: {
    get: (...args: any[]) => mockApiGet(...args),
    update: (...args: any[]) => mockApiUpdate(...args),
  },
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

let mockParams: Record<string, string> = { id: "1" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => {}),
  unlockAsync: jest.fn(async () => {}),
  OrientationLock: { PORTRAIT_UP: 1, LANDSCAPE_RIGHT: 2 },
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

// Flush pending microtasks (effect async work, resolved api promises).
async function flush(rounds = 4) {
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

const scanMsg = {
  type: "scanComplete",
  time: 1.2,
  score: 2,
  angles: { leftKnee: 88, rightKnee: 90 },
  risks: { leftKnee: 2, rightKnee: 0, leftHip: 0, rightHip: 0, leftElbow: 0, rightElbow: 0 },
  frame: "frame-data",
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

    emit({ type: "angles" }); // model ready
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

    emit({ type: "angles" });
    emit(scanMsg);
    await flush();

    expect(screen.getByText("Review the flagged joints")).toBeTruthy();
    expect(screen.queryByText("GROUNDED_INJURY_TIP")).toBeNull();
  });

  it("falls back to the measured card when the poll never grounds (GET timeout)", async () => {
    mockApiGet.mockImplementation(() => Promise.resolve(resp(false))); // never grounds

    render(<SkeletonScreen />);
    await flush();

    emit({ type: "angles" });
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

    emit({ type: "angles" }); // model ready; no fresh scan needed

    // Performance section renders from the load-time grounded flag (no scanResult required).
    expect(screen.getByText("GROUNDED_PERF_TIP")).toBeTruthy();
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

    emit({ type: "angles" });
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
});
