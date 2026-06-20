/**
 * Tests that verify movementType is persisted after sport detection.
 *
 * Two paths under test:
 *   1. Sports-match path — when Claude detects the same sport as the session,
 *      analyses.update is called silently with { movementType }.
 *   2. Sport-switch path — when Claude detects a different sport and the user
 *      taps "Switch to …", analyses.update is called with { sport, movementType }.
 *
 * Mocking strategy:
 *   - react-native-webview is replaced with a thin stub that captures onMessage
 *     so tests can inject synthetic WebView messages directly.
 *   - expo-file-system/legacy resolves instantly so the WebView renders.
 *   - AsyncStorage returns a video URI so the component takes the video path.
 *   - @/lib/api mocks give each test full control over detectSport / update.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

// ─── Captured WebView callback ────────────────────────────────────────────────

let capturedOnMessage:
  | ((e: { nativeEvent: { data: string } }) => void)
  | null = null;

// ─── Mock functions ───────────────────────────────────────────────────────────

const mockAnalysesGet = jest.fn();
const mockAnalysesUpdate = jest.fn();
const mockAnalysesDetectSport = jest.fn();

// ─── Module mocks (hoisted before imports) ────────────────────────────────────

jest.mock("react-native-webview", () => ({
  WebView: ({ onMessage }: any) => {
    capturedOnMessage = onMessage;
    return null;
  },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: "42" }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => {
      if (key === "video_uri_42") return "file:///test/video.mp4";
      return null;
    }),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiGet: jest.fn(async () => []),
  },
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///docs/",
  copyAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
  EncodingType: { UTF8: "utf8" },
}));

jest.mock("@/lib/api", () => ({
  analyses: {
    get: (...args: any[]) => mockAnalysesGet(...args),
    update: (...args: any[]) => mockAnalysesUpdate(...args),
    detectSport: (...args: any[]) => mockAnalysesDetectSport(...args),
  },
}));

// ─── Component import (after mocks) ───────────────────────────────────────────

import PersonSelectScreen from "../[id]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates and async micro-tasks. */
async function flush(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {});
  }
}

/**
 * Render the screen and wait until the WebView has mounted and captured its
 * onMessage handler. Returns the query helpers from render().
 */
async function renderAndWaitForWebView() {
  const result = render(<PersonSelectScreen />);
  // Give effects enough time to: resolve AsyncStorage + analysesApi.get →
  // resolve FileSystem ops → render the WebView → capture onMessage.
  await flush();
  return result;
}

/** Send a synthetic WebView frame message carrying a base64 image. */
function sendFrameMessage(imageBase64 = "data:image/jpeg;base64,/9j/FAKE") {
  if (!capturedOnMessage) throw new Error("WebView onMessage was not captured — WebView did not render");
  act(() => {
    capturedOnMessage!({ nativeEvent: { data: JSON.stringify({ type: "frame", imageBase64 }) } });
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  capturedOnMessage = null;
  mockAnalysesGet.mockReset();
  mockAnalysesUpdate.mockReset();
  mockAnalysesDetectSport.mockReset();
  mockAnalysesUpdate.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Suite 1: Sports-match path ───────────────────────────────────────────────

describe("PersonSelectScreen — sports-match path", () => {
  it("calls analyses.update with movementType when Claude's sport matches the session sport", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "running", movementType: "Sprint" });

    await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    expect(mockAnalysesUpdate).toHaveBeenCalledTimes(1);
    expect(mockAnalysesUpdate).toHaveBeenCalledWith("42", { movementType: "Sprint" });
  });

  it("does not call analyses.update when Claude returns no movementType (unknown)", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "running", movementType: "unknown" });

    await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    expect(mockAnalysesUpdate).not.toHaveBeenCalled();
  });

  it("does not call analyses.update when Claude returns empty movementType", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "running", movementType: "" });

    await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    expect(mockAnalysesUpdate).not.toHaveBeenCalled();
  });

  it("matches sport aliases — soccer/football are treated as the same sport", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "soccer" }, tips: [], injuryRisks: [] });
    // Claude returns "football" which is an alias for soccer — should match silently
    mockAnalysesDetectSport.mockResolvedValue({ sport: "football", movementType: "Dribbling" });

    await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    // Alias match → silent movementType PATCH (no sport change)
    expect(mockAnalysesUpdate).toHaveBeenCalledTimes(1);
    expect(mockAnalysesUpdate).toHaveBeenCalledWith("42", { movementType: "Dribbling" });
  });
});

// ─── Suite 2: Sport-switch path ───────────────────────────────────────────────

describe("PersonSelectScreen — sport-switch path", () => {
  it("calls analyses.update with sport + movementType when the user confirms a sport switch", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "soccer", movementType: "Dribbling" });

    const { getByText } = await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    // The mismatch card should be visible with a switch button
    const switchBtn = getByText(/Switch to soccer/i);
    await act(async () => {
      fireEvent.press(switchBtn);
    });
    await flush();

    expect(mockAnalysesUpdate).toHaveBeenCalledTimes(1);
    expect(mockAnalysesUpdate).toHaveBeenCalledWith("42", {
      sport: "soccer",
      movementType: "Dribbling",
    });
  });

  it("calls analyses.update with sport only (no movementType) when Claude returned unknown movement", async () => {
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "soccer", movementType: "unknown" });

    const { getByText } = await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    const switchBtn = getByText(/Switch to soccer/i);
    await act(async () => {
      fireEvent.press(switchBtn);
    });
    await flush();

    expect(mockAnalysesUpdate).toHaveBeenCalledTimes(1);
    // movementType is null (unknown was filtered) so only sport goes into the PATCH
    expect(mockAnalysesUpdate).toHaveBeenCalledWith("42", { sport: "soccer" });
  });

  it("does not call analyses.update (silent PATCH) when sports mismatch is detected", async () => {
    // On mismatch the component shows a warning card but does NOT auto-PATCH —
    // it waits for the user to explicitly press "Switch to …".
    mockAnalysesGet.mockResolvedValue({ analysis: { sport: "running" }, tips: [], injuryRisks: [] });
    mockAnalysesDetectSport.mockResolvedValue({ sport: "soccer", movementType: "Dribbling" });

    await renderAndWaitForWebView();
    sendFrameMessage();
    await flush();

    // No auto-patch on mismatch — user must confirm
    expect(mockAnalysesUpdate).not.toHaveBeenCalled();
  });
});
