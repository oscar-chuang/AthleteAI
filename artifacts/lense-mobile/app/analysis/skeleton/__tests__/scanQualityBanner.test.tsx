import React from "react";
import { render, act, screen, fireEvent } from "@testing-library/react-native";
import { Dimensions } from "react-native";

// ─── Drive the mocks from per-test state ──────────────────────────────────────
const mockApiGet = jest.fn();
const mockApiUpdate = jest.fn();

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
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { UTF8: "utf8" },
}));

// Inline mock following the same pattern as grounding.test.tsx so the factory
// closure is self-contained (no reference to an outer variable that would be
// in the temporal dead zone when babel hoists the jest.mock call).
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

import SkeletonScreen from "../[id]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAsyncStorage() {
  return require("@react-native-async-storage/async-storage").default as {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
  };
}

async function flush(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

function emit(msg: any) {
  act(() => {
    webviewOnMessage?.({ nativeEvent: { data: JSON.stringify(msg) } });
  });
}

// A capture whose landmarks all have very low visibility (0.10) so that
// computeScanQuality returns "low" (threshold is avg < 0.45 for KEY_LANDMARKS).
const lowQualityCapture = {
  id: "cap-low",
  kind: "worst",
  time: 1.0,
  aspect: 0.6,
  frame: "data:image/jpeg;base64,zzz",
  lm: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.10 })),
  jr: { leftKnee: { deg: 88, lvl: 2 } },
  joints: ["leftKnee"],
  maxLvl: 2,
};

const scanMsg = {
  type: "scanComplete",
  time: 1.0,
  score: 2,
  angles: { leftKnee: 88, rightKnee: 90 },
  risks: { leftKnee: 2, rightKnee: 0, leftHip: 0, rightHip: 0, leftElbow: 0, rightElbow: 0 },
  frame: "frame-data",
};

function apiResp() {
  return {
    analysis: { id: 42, sport: "weightlifting", biomechanicsApplied: false },
    tips: [],
    injuryRisks: [],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Dimensions, "get").mockReturnValue({
    width: 390,
    height: 844,
    scale: 1,
    fontScale: 1,
  } as any);
  mockParams = { id: "42" };
  webviewOnMessage = undefined;
  mockApiGet.mockReset();
  mockApiUpdate.mockReset();
  mockApiUpdate.mockResolvedValue({ success: true });

  const AsyncStorage = getAsyncStorage();
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
  AsyncStorage.removeItem.mockReset();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ─── Scan quality banner — stays hidden on re-scan within same session ────────

describe("scan quality banner — re-scan within same mounted session", () => {
  it("does not reappear after pressing × when a new scan completes without unmounting", async () => {
    mockApiGet.mockResolvedValue(apiResp());

    const AsyncStorage = getAsyncStorage();
    // No dismissal key pre-set — banner will appear on first low-quality scan.
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "video_uri_42") return Promise.resolve("file:///video.mp4");
      return Promise.resolve(null);
    });

    render(<SkeletonScreen />);
    await flush();

    // ── First scan: low quality → banner appears ─────────────────────────────
    emit({ type: "capture", capture: lowQualityCapture });
    await flush();
    emit(scanMsg);
    await flush();

    const dismissBtn = screen.getByTestId("scan-quality-banner-dismiss");
    expect(dismissBtn).toBeTruthy();

    // ── User dismisses the banner ─────────────────────────────────────────────
    fireEvent.press(dismissBtn);
    await flush();

    expect(screen.queryByTestId("scan-quality-banner-dismiss")).toBeNull();

    // ── Re-scan completes on the same mounted screen (no unmount/remount) ─────
    // Simulates the WebView completing another pose estimation pass — the same
    // low-quality result arrives again, which would normally show the banner.
    emit({ type: "capture", capture: lowQualityCapture });
    await flush();
    emit(scanMsg);
    await flush();

    // The dismissed flag must survive the re-scan; the banner must stay hidden.
    expect(screen.queryByTestId("scan-quality-banner-dismiss")).toBeNull();
  });
});

// ─── Scan quality banner — persistence across mounts ─────────────────────────

describe("scan quality banner — persistence across mounts", () => {
  it("hides the banner on mount when scanQualityDismissed_<id> is already set in AsyncStorage", async () => {
    mockApiGet.mockResolvedValue(apiResp());

    const AsyncStorage = getAsyncStorage();
    // Pre-populate the dismissal key so the banner should never appear.
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "scanQualityDismissed_42") return Promise.resolve("1");
      if (key === "video_uri_42") return Promise.resolve("file:///video.mp4");
      return Promise.resolve(null);
    });

    render(<SkeletonScreen />);
    await flush();

    // Drive a low-quality capture so heroScanQuality would be "low" without dismissal.
    emit({ type: "capture", capture: lowQualityCapture });
    await flush();
    emit(scanMsg);
    await flush();

    // The key was pre-set — the dismissible banner must never have appeared.
    expect(screen.queryByTestId("scan-quality-banner-dismiss")).toBeNull();
  });

  it("shows the banner when the dismissal key is absent and hides it after pressing ×", async () => {
    mockApiGet.mockResolvedValue(apiResp());

    const AsyncStorage = getAsyncStorage();
    // No dismissal key set yet.
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "video_uri_42") return Promise.resolve("file:///video.mp4");
      return Promise.resolve(null);
    });

    render(<SkeletonScreen />);
    await flush();

    // Drive a low-quality capture so heroScanQuality resolves to "low".
    emit({ type: "capture", capture: lowQualityCapture });
    await flush();
    emit(scanMsg);
    await flush();

    // Banner dismiss button must be visible before the user taps ×.
    const dismissBtn = screen.getByTestId("scan-quality-banner-dismiss");
    expect(dismissBtn).toBeTruthy();

    // Pressing × hides the banner and persists the dismissal key to AsyncStorage.
    fireEvent.press(dismissBtn);
    await flush();

    expect(screen.queryByTestId("scan-quality-banner-dismiss")).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("scanQualityDismissed_42", "1");
  });
});
