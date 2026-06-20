import React from "react";
import { render, act } from "@testing-library/react-native";

import { handleNotificationResponse } from "@/utils/notificationHandler";
import { NotificationListener } from "../_layout";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

const mockAddListener = jest.fn();
const mockRemove = jest.fn();
const mockGetLast = jest.fn();
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockAddListener(...args),
  getLastNotificationResponseAsync: (...args: unknown[]) => mockGetLast(...args),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  scheduleNotificationAsync: jest.fn(async () => {}),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("@/lib/authContext", () => ({
  useAuth: () => ({ isLoading: false }),
}));

jest.mock("@/lib/themeContext", () => ({
  useTheme: () => ({ colors: { background: "#000", foreground: "#fff" } }),
}));

function makeResponse(screen: unknown, scrollTo?: string): any {
  return {
    notification: {
      request: {
        content: {
          data: { screen, ...(scrollTo !== undefined ? { scrollTo } : {}) },
        },
      },
    },
  };
}

// ─── Unit tests for the extracted handler ────────────────────────────────────

describe("handleNotificationResponse — routing logic", () => {
  let router: { navigate: jest.Mock };

  beforeEach(() => {
    router = { navigate: jest.fn() };
  });

  it("navigates to /(tabs)/progress when data.screen is 'progress'", () => {
    handleNotificationResponse(makeResponse("progress"), router as any);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/(tabs)/progress" })
    );
  });

  it("passes scrollTo param through when present", () => {
    handleNotificationResponse(makeResponse("progress", "trends"), router as any);
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ scrollTo: "trends" }) })
    );
  });

  it("does NOT navigate when data.screen is a different value", () => {
    handleNotificationResponse(makeResponse("home"), router as any);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does NOT navigate when data.screen is an empty string", () => {
    handleNotificationResponse(makeResponse(""), router as any);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does NOT navigate when data.screen is undefined", () => {
    handleNotificationResponse(makeResponse(undefined), router as any);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing when response is null", () => {
    handleNotificationResponse(null, router as any);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing when response is undefined", () => {
    handleNotificationResponse(undefined, router as any);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

// ─── Integration tests for NotificationListener wiring ───────────────────────

describe("NotificationListener — listener wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddListener.mockReturnValue({ remove: mockRemove });
    mockGetLast.mockResolvedValue(null);
  });

  it("registers addNotificationResponseReceivedListener on mount", () => {
    render(<NotificationListener />);
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(typeof mockAddListener.mock.calls[0][0]).toBe("function");
  });

  it("removes the subscription on unmount", () => {
    const { unmount } = render(<NotificationListener />);
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("navigates to progress screen when listener callback receives data.screen=progress", async () => {
    render(<NotificationListener />);
    const callback = mockAddListener.mock.calls[0][0] as (r: unknown) => void;
    await act(async () => {
      callback(makeResponse("progress", "trends"));
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/(tabs)/progress" })
    );
  });

  it("does NOT navigate when listener callback receives a non-progress screen", async () => {
    render(<NotificationListener />);
    const callback = mockAddListener.mock.calls[0][0] as (r: unknown) => void;
    await act(async () => {
      callback(makeResponse("home"));
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates via getLastNotificationResponseAsync on mount when data.screen=progress", async () => {
    mockGetLast.mockResolvedValue(makeResponse("progress"));
    render(<NotificationListener />);
    await act(async () => {});
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/(tabs)/progress" })
    );
  });
});
