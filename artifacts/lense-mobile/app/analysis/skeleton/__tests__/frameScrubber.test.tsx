import React from "react";
import { render, act, screen, within, fireEvent } from "@testing-library/react-native";
import { Animated, Dimensions, PanResponder } from "react-native";

// ─── Module-level mock handles ─────────────────────────────────────────────────
const mockApiGet    = jest.fn();
const mockApiUpdate = jest.fn();

let webviewOnMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined;

jest.mock("@/lib/api", () => ({
  analyses: {
    get:    (...args: any[]) => mockApiGet(...args),
    update: (...args: any[]) => mockApiUpdate(...args),
  },
  drills: {
    getCompleted: jest.fn(async () => ({ completedTipIds: [] })),
    markDone:     jest.fn(async () => ({ success: true })),
    markUndone:   jest.fn(async () => ({ success: true })),
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

jest.mock("@/components/FrozenSkeleton", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(View, { testID: "frozen-skeleton" }),
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

let mockParams: Record<string, string> = { id: "42" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory:     "file:///cache/",
  copyAsync:          jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType:       { UTF8: "utf8" },
}));

// Per-test AsyncStorage configured in beforeEach so individual tests can
// override getItem without fighting a module-level closure.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets:  () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider:   ({ children }: any) => children,
}));

import SkeletonScreen from "../[id]";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAsyncStorage() {
  return require("@react-native-async-storage/async-storage").default as {
    getItem:    jest.Mock;
    setItem:    jest.Mock;
    removeItem: jest.Mock;
  };
}

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// 33 fully-visible landmarks evenly spread across a unit square so that the
// scrub overlay bones and dots can project at least some landmarks.
const FULL_LM = Array.from({ length: 33 }, (_, i) => ({
  x: (i % 6) / 5,
  y: Math.floor(i / 6) / 5,
  v: 0.95,
}));

const FRAME_TICKS = [
  {
    t: 0.0,
    lm: FULL_LM,
    angles: { leftKnee: 88, rightKnee: 90 },
    jr: {
      leftKnee:  { deg: 88, lvl: 2 },
      rightKnee: { deg: 90, lvl: 0 },
    },
  },
  {
    t: 10.0,
    lm: FULL_LM,
    angles: { leftKnee: 120, rightKnee: 118 },
    jr: {
      leftKnee:  { deg: 120, lvl: 1 },
      rightKnee: { deg: 118, lvl: 0 },
    },
  },
];

const CAPTURE_MSG = {
  type: "capture",
  capture: {
    id:     "cap0",
    kind:   "worst",
    time:   1.0,
    aspect: 0.6,
    frame:  "data:image/jpeg;base64,zzz",
    lm:     FULL_LM,
    jr:     { leftKnee: { deg: 88, lvl: 2 } },
    joints: ["leftKnee"],
    maxLvl: 2,
  },
};

// scanComplete payload that carries frameTicks so the screen persists them and
// shows the scrubber bar.
const SCAN_COMPLETE_MSG = {
  type:       "scanComplete",
  angles:     { leftKnee: 88, rightKnee: 90 },
  risks:      { leftKnee: 2, rightKnee: 0, leftHip: 0, rightHip: 0, leftElbow: 0, rightElbow: 0 },
  frame:      "frame-data",
  frameTicks: FRAME_TICKS,
};

function apiResp(grounded = false) {
  return {
    analysis:    { id: 42, sport: "weightlifting", biomechanicsApplied: grounded },
    tips:        [],
    injuryRisks: [],
  };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

// PanResponder capture — the scrubber uses a PanResponder and the native gesture
// system (touch history) is not available in Jest/RNTL. We spy on PanResponder.create
// so that each time the component creates a responder we capture the raw
// onPanResponderGrant / onPanResponderMove callbacks. Tests then call those
// callbacks directly with a minimal event object, bypassing the gesture system.
let capturedPanGrant: ((evt: { nativeEvent: { locationX: number } }) => void) | undefined;
let capturedPanMove:  ((evt: { nativeEvent: { locationX: number } }) => void) | undefined;
let panResponderSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Dimensions, "get").mockReturnValue({
    width: 390, height: 844, scale: 1, fontScale: 1,
  } as any);

  // Capture the PanResponder callbacks without touching the gesture system.
  capturedPanGrant = undefined;
  capturedPanMove  = undefined;
  panResponderSpy = jest.spyOn(PanResponder, "create").mockImplementation((config) => {
    capturedPanGrant = (evt) => config.onPanResponderGrant?.(evt as any, {} as any);
    capturedPanMove  = (evt) => config.onPanResponderMove?.(evt as any, {} as any);
    return { panHandlers: {} };
  });

  mockParams       = { id: "42" };
  webviewOnMessage = undefined;
  mockApiGet.mockReset();
  mockApiUpdate.mockReset();
  mockApiGet.mockResolvedValue(apiResp());
  mockApiUpdate.mockResolvedValue({ success: true });

  const AsyncStorage = getAsyncStorage();
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
  AsyncStorage.removeItem.mockReset();
  // Default: return the video URI and pre-stored frameTicks for analysis 42.
  AsyncStorage.getItem.mockImplementation((key: string) => {
    if (key === "video_uri_42")  return Promise.resolve("file:///video.mp4");
    if (key === "frameTicks_42") return Promise.resolve(JSON.stringify(FRAME_TICKS));
    return Promise.resolve(null);
  });
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
});

afterEach(() => {
  panResponderSpy.mockRestore();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ─── Frame scrubber: visibility ────────────────────────────────────────────────

describe("frame scrubber — visibility", () => {
  it("shows the FRAME SCRUBBER label after frameTicks arrive via AsyncStorage on mount", async () => {
    render(<SkeletonScreen />);
    await flush();

    // Drive a capture then the scan-complete so scanDone=true and hero is set.
    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    expect(screen.getByText("FRAME SCRUBBER")).toBeTruthy();
  });

  it("shows the FRAME SCRUBBER label when frameTicks arrive inside the scanComplete message", async () => {
    // AsyncStorage has no pre-stored frameTicks; they arrive only via the scan message.
    const AsyncStorage = getAsyncStorage();
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "video_uri_42") return Promise.resolve("file:///video.mp4");
      return Promise.resolve(null);
    });

    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    expect(screen.getByText("FRAME SCRUBBER")).toBeTruthy();
  });

  it("does NOT show the scrubber when no frameTicks are available", async () => {
    const AsyncStorage = getAsyncStorage();
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "video_uri_42") return Promise.resolve("file:///video.mp4");
      return Promise.resolve(null);
    });

    const scanWithoutTicks = { ...SCAN_COMPLETE_MSG, frameTicks: [] };

    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(scanWithoutTicks);
    await flush();

    expect(screen.queryByText("FRAME SCRUBBER")).toBeNull();
  });
});

// ─── Frame scrubber: timecode updates on scrub ─────────────────────────────────

describe("frame scrubber — timecode updates when the thumb is dragged", () => {
  it("initially shows the first-tick timecode once frameTicks are loaded", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // scrubRatio=0 → scrubTick=frameTicks[0] (t=0 s → "0:00").
    // The label also appends the total duration (10 s → "0:10").
    expect(screen.getByText("0:00 / 0:10")).toBeTruthy();
  });

  it("updates the timecode display when the grant gesture moves the scrubber to the end", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // scrubTrackWidthRef defaults to 1 (no layout event in tests).
    // locationX=1 → ratio = min(1, 1/1) = 1 → bsearchTick picks frameTicks[1] (t=10 s).
    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 1 } });
    });

    expect(screen.getByText("0:10 / 0:10")).toBeTruthy();
  });

  it("updates the timecode when the move gesture is fired after the grant", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // Grant at the very start (ratio≈0 → t=0 s).
    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 0 } });
    });
    expect(screen.getByText("0:00 / 0:10")).toBeTruthy();

    // Move to the end (ratio=1 → t=10 s).
    await act(async () => {
      capturedPanMove?.({ nativeEvent: { locationX: 1 } });
    });
    expect(screen.getByText("0:10 / 0:10")).toBeTruthy();
  });
});

// ─── Frame scrubber: SVG overlay switches on scrub ────────────────────────────

describe("frame scrubber — SVG overlay switches from frozen capture to scrub skeleton", () => {
  it("renders the scrub overlay SVG once frameTicks are present (scrubTick is active)", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // With frameTicks loaded, scrubTick is the first tick (t=0), so the live SVG
    // overlay is rendered on top of the frozen skeleton capture.
    expect(screen.getByTestId("scrub-overlay")).toBeTruthy();
  });

  it("overlay tracks the selected tick — scrub to end moves to frameTicks[1] skeleton", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // Overlay renders before the scrub (scrubTick = first tick).
    expect(screen.getByTestId("scrub-overlay")).toBeTruthy();

    // Scrub to the last tick — overlay must still be present (scrubTick updated).
    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 1 } });
    });
    expect(screen.getByTestId("scrub-overlay")).toBeTruthy();

    // The timecode confirms the active tick switched to t=10.
    expect(screen.getByText("0:10 / 0:10")).toBeTruthy();
  });

  it("persists frameTicks to AsyncStorage when they arrive in the scanComplete message", async () => {
    const AsyncStorage = getAsyncStorage();

    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // The screen must write ticks to storage so they survive a remount.
    const setItemCalls = AsyncStorage.setItem.mock.calls as [string, string][];
    const ticksWrite = setItemCalls.find(([key]) => key === "frameTicks_42");
    expect(ticksWrite).toBeTruthy();
    const storedTicks = JSON.parse(ticksWrite![1]);
    expect(Array.isArray(storedTicks)).toBe(true);
    expect(storedTicks.length).toBe(FRAME_TICKS.length);
  });
});

// ─── Frame scrubber: floating label appears and disappears ─────────────────────

describe("frame scrubber — floating scrub label visibility", () => {
  let animTimingSpy: jest.SpyInstance;
  let capturedPanRelease: (() => void) | undefined;

  beforeEach(() => {
    // Capture onPanResponderRelease in addition to grant/move.
    // Restore the outer spy first so we can re-install with release support.
    panResponderSpy.mockRestore();
    panResponderSpy = jest.spyOn(PanResponder, "create").mockImplementation((config) => {
      capturedPanGrant   = (evt) => config.onPanResponderGrant?.(evt as any, {} as any);
      capturedPanMove    = (evt) => config.onPanResponderMove?.(evt as any, {} as any);
      capturedPanRelease = ()    => config.onPanResponderRelease?.({} as any, {} as any);
      return { panHandlers: {} };
    });

    // Spy on Animated.timing to inspect toValue without running real animations.
    animTimingSpy = jest.spyOn(Animated, "timing").mockImplementation(
      (_value, _config) => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() } as any),
    );
  });

  afterEach(() => {
    animTimingSpy.mockRestore();
    capturedPanRelease = undefined;
  });

  async function setupWithTicks() {
    render(<SkeletonScreen />);
    await flush();
    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();
  }

  it("floating label element is rendered inside the scrubber track and starts hidden", async () => {
    await setupWithTicks();

    // Structural: the floating label must be a descendant of scrubber-track.
    const track = screen.getByTestId("scrubber-track");
    const label = within(track).getByTestId("scrub-floating-label");
    expect(label).toBeTruthy();

    // Initial state: opacity must be 0 — the label is hidden before any drag gesture.
    // The style array contains { opacity: Animated.Value(0) }; read the current value.
    const styles: any[] = Array.isArray(label.props.style)
      ? label.props.style
      : [label.props.style];
    const styleWithOpacity = styles.find(
      (s: any) => s && typeof s === "object" && "opacity" in s,
    );
    const initialOpacity =
      typeof styleWithOpacity?.opacity === "number"
        ? styleWithOpacity.opacity
        : styleWithOpacity?.opacity?.__getValue?.();
    expect(initialOpacity).toBe(0);
  });

  it("animates opacity to 1 when the pan responder grant fires", async () => {
    await setupWithTicks();
    animTimingSpy.mockClear();

    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 0 } });
    });

    // At least one Animated.timing call must target opacity 1 (the fade-in).
    const fadeIn = animTimingSpy.mock.calls.find(
      ([, cfg]: [unknown, { toValue: number }]) => cfg.toValue === 1,
    );
    expect(fadeIn).toBeTruthy();
  });

  it("animates opacity to 0 after the 500 ms delay when the pan responder releases", async () => {
    await setupWithTicks();

    // Grant so the label is visible.
    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 0 } });
    });

    animTimingSpy.mockClear();

    // Release — this schedules a 500 ms timer before fading out.
    await act(async () => {
      capturedPanRelease?.();
    });

    // No fade-out should have been triggered yet.
    const earlyFade = animTimingSpy.mock.calls.find(
      ([, cfg]: [unknown, { toValue: number }]) => cfg.toValue === 0,
    );
    expect(earlyFade).toBeUndefined();

    // Advance past the 500 ms delay — the fade-out animation must now start.
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    const fadeOut = animTimingSpy.mock.calls.find(
      ([, cfg]: [unknown, { toValue: number }]) => cfg.toValue === 0,
    );
    expect(fadeOut).toBeTruthy();
  });
});

// ─── Frame scrubber: tapping a risk tick mark snaps the scrubber ──────────────
//
// FRAME_TICKS has two entries both with risk:
//   [0] t=0.0  leftKnee lvl=2 → rendered as scrub-tick-0, pos=0
//   [1] t=10.0 leftKnee lvl=1 → rendered as scrub-tick-1, pos=1
//
// Pressing scrub-tick-1 must call setScrubRatio(1) → scrubTick becomes
// frameTicks[1] (t=10 s) → timecode label shows "0:10 / 0:10".

describe("frame scrubber — tapping a risk tick mark snaps the scrubber", () => {
  it("pressing a risk tick mark updates the timecode to that tick's timestamp", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // Scrubber starts at the first tick (t=0 s).
    expect(screen.getByText("0:00 / 0:10")).toBeTruthy();

    // Both FRAME_TICKS have risk so two tick marks are rendered.
    // scrub-tick-1 maps to frameTicks[1] at t=10 s → pos=1.
    await act(async () => {
      fireEvent.press(screen.getByTestId("scrub-tick-1"));
    });

    // scrubRatio is now 1 → bsearchTick picks frameTicks[1] (t=10 s).
    expect(screen.getByText("0:10 / 0:10")).toBeTruthy();
  });

  it("pressing the first risk tick mark snaps the scrubber back to t=0", async () => {
    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(SCAN_COMPLETE_MSG);
    await flush();

    // First drag to the end so we know a state change happens when we tap tick 0.
    await act(async () => {
      capturedPanGrant?.({ nativeEvent: { locationX: 1 } });
    });
    expect(screen.getByText("0:10 / 0:10")).toBeTruthy();

    // Tap the first tick mark (t=0 s, pos=0) — scrubber should snap back.
    await act(async () => {
      fireEvent.press(screen.getByTestId("scrub-tick-0"));
    });

    expect(screen.getByText("0:00 / 0:10")).toBeTruthy();
  });

  it("tick marks are only rendered for frames that have at least one risk joint (lvl >= 1)", async () => {
    // Build ticks where only the second frame has risk.
    const SAFE_ONLY_TICKS = [
      {
        t: 0.0,
        lm: FULL_LM,
        angles: { leftKnee: 100 },
        jr: { leftKnee: { deg: 100, lvl: 0 }, rightKnee: { deg: 100, lvl: 0 } },
      },
      {
        t: 5.0,
        lm: FULL_LM,
        angles: { leftKnee: 170 },
        jr: { leftKnee: { deg: 170, lvl: 2 }, rightKnee: { deg: 100, lvl: 0 } },
      },
    ];

    const AsyncStorage = getAsyncStorage();
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "video_uri_42")  return Promise.resolve("file:///video.mp4");
      if (key === "frameTicks_42") return Promise.resolve(JSON.stringify(SAFE_ONLY_TICKS));
      return Promise.resolve(null);
    });

    const scanWithSafeTicks = { ...SCAN_COMPLETE_MSG, frameTicks: SAFE_ONLY_TICKS };

    render(<SkeletonScreen />);
    await flush();

    emit(CAPTURE_MSG);
    await flush();
    emit(scanWithSafeTicks);
    await flush();

    // Only the second tick (idx=1, lvl=2) has risk, so scrub-tick-0 must not exist.
    expect(screen.queryByTestId("scrub-tick-0")).toBeNull();
    // The risky tick is idx=1 in the ticks array → testID scrub-tick-1.
    expect(screen.getByTestId("scrub-tick-1")).toBeTruthy();
  });
});
