import { renderHook, act } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue("seen"),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/api", () => ({
  analyses: { create: jest.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(msg: string, code: string) { super(msg); this.code = code; }
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoUpload } from "@/hooks/useVideoUpload";

const makeRouter = () => ({ push: jest.fn() }) as any;

const mockProfile = { sport: "Running", weeklyGoal: 3 } as any;
const mockHeaderStats = { thisWeek: 0 };
const mockLoadAnalyses = jest.fn().mockResolvedValue(undefined);

describe("useVideoUpload — mandatory guidance gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("seen");
  });

  it("shows recording tips modal on handleUpload even when AsyncStorage has a 'seen' value", async () => {
    const router = makeRouter();
    const { result } = renderHook(() =>
      useVideoUpload(mockProfile, mockHeaderStats, mockLoadAnalyses, router)
    );

    expect(result.current.showRecordingTips).toBe(false);

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(result.current.showRecordingTips).toBe(true);
    expect(result.current.pendingAction).toBe("upload");
  });

  it("shows recording tips modal on handleRecord even when AsyncStorage has a 'seen' value", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    const router = makeRouter();
    const { result } = renderHook(() =>
      useVideoUpload(mockProfile, mockHeaderStats, mockLoadAnalyses, router)
    );

    expect(result.current.showRecordingTips).toBe(false);

    await act(async () => {
      await result.current.handleRecord();
    });

    expect(result.current.showRecordingTips).toBe(true);
    expect(result.current.pendingAction).toBe("record");

    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("shows recording tips modal on handleUpload when AsyncStorage returns null", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const router = makeRouter();
    const { result } = renderHook(() =>
      useVideoUpload(mockProfile, mockHeaderStats, mockLoadAnalyses, router)
    );

    await act(async () => {
      await result.current.handleUpload();
    });

    expect(result.current.showRecordingTips).toBe(true);
  });

  it("does not read AsyncStorage for RECORDING_TIPS_KEY during handleUpload", async () => {
    const router = makeRouter();
    const { result } = renderHook(() =>
      useVideoUpload(mockProfile, mockHeaderStats, mockLoadAnalyses, router)
    );

    await act(async () => {
      await result.current.handleUpload();
    });

    const getItemCalls = (AsyncStorage.getItem as jest.Mock).mock.calls;
    const tipsKeyCalls = getItemCalls.filter(([key]: [string]) =>
      key === "recording_tips_dismissed"
    );
    expect(tipsKeyCalls).toHaveLength(0);
  });
});
