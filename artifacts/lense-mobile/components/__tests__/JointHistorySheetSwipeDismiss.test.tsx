/**
 * Verifies that JointHistorySheet tracks the drag gesture and dismisses
 * with animation.
 *
 * Strategy:
 *  - PanResponder.create is spied on to capture onPanResponderMove and
 *    onPanResponderRelease so tests can invoke them directly with a controlled
 *    gestureState, without needing to simulate native touch events.
 *  - The spy delegates to the real implementation so panHandlers are still
 *    spread onto the sheet container and the component renders normally.
 *  - Animated.timing is spied on to fire its callback synchronously, making
 *    the animation-completion path (which calls onClose) deterministic.
 *  - react-native-svg is mocked to avoid SVG rendering issues in the test env.
 *
 * Gesture behaviour contract:
 *  - Release ≥ 80 px down → animate off-screen → call onClose
 *  - Release < 80 px down → spring back to 0   → do NOT call onClose
 *  - Upward drag (negative dy)                  → do NOT call onClose
 */

import React from "react";
import { PanResponder, Animated, type PanResponderGestureState } from "react-native";
import { render, act } from "@testing-library/react-native";

// ─── SVG stub ─────────────────────────────────────────────────────────────────

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
    Line: () => null,
    Path: () => null,
    Polyline: () => null,
    Text: () => null,
    Rect: () => null,
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// ─── Component under test (must come after all mocks) ─────────────────────────

import JointHistorySheet from "@/components/JointHistorySheet";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_DATA = [
  { analysisId: "a1", date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
  { analysisId: "a2", date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
  { analysisId: "a3", date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface CapturedHandlers {
  move?: (e: any, gs: PanResponderGestureState) => void;
  release?: (e: any, gs: PanResponderGestureState) => void;
}

/** Spy on PanResponder.create, delegate to real impl, capture move+release. */
function spyOnPanResponder(): CapturedHandlers {
  const captured: CapturedHandlers = {};
  const original = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, "create").mockImplementation((config) => {
    captured.move = config.onPanResponderMove;
    captured.release = config.onPanResponderRelease;
    return original(config);
  });
  return captured;
}

/**
 * Spy on Animated.timing to fire its start-callback synchronously.
 * This makes animation-completion-dependent behaviour (like calling onClose)
 * testable without needing real timers or native drivers.
 */
function spyOnAnimatedTiming() {
  return jest.spyOn(Animated, "timing").mockImplementation(
    (value: Animated.Value | Animated.ValueXY, config: Animated.TimingAnimationConfig) => ({
      start(cb?: Animated.EndCallback) {
        if (config.toValue !== undefined) {
          (value as Animated.Value).setValue(config.toValue as number);
        }
        cb?.({ finished: true });
      },
      stop() {},
      reset() {},
    })
  );
}

function makeGestureState(dy: number): PanResponderGestureState {
  return {
    dy, dx: 0, vx: 0, vy: 0.5, moveX: 0, moveY: 0, x0: 0, y0: 0,
    stateID: 0, numberActiveTouches: 1,
  } as PanResponderGestureState;
}

const EVT = {} as any;

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  jest.restoreAllMocks();
});

describe("JointHistorySheet — swipe-down dismissal", () => {
  it("renders the drag handle with the correct testID", async () => {
    spyOnPanResponder();
    const { queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />,
    );
    await act(async () => {});
    expect(queryByTestId("sheet-drag-handle")).not.toBeNull();
  });

  it("renders the sheet container with the correct testID", async () => {
    spyOnPanResponder();
    const { queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />,
    );
    await act(async () => {});
    expect(queryByTestId("sheet-swipe-container")).not.toBeNull();
  });

  it("does not call onClose when released below threshold (30 px)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();
    const onClose = jest.fn();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />);
    await act(async () => {});

    await act(async () => {
      handlers.release?.(EVT, makeGestureState(30));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose when gesture is upward (negative dy)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();
    const onClose = jest.fn();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />);
    await act(async () => {});

    await act(async () => {
      handlers.release?.(EVT, makeGestureState(-120));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose after animation completes when released at threshold (80 px)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();
    const onClose = jest.fn();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />);
    await act(async () => {});

    await act(async () => {
      handlers.release?.(EVT, makeGestureState(80));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose after animation completes when released well above threshold (100 px)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();
    const onClose = jest.fn();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />);
    await act(async () => {});

    await act(async () => {
      handlers.release?.(EVT, makeGestureState(100));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose a second time on a double-release (closing guard)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();
    const onClose = jest.fn();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />);
    await act(async () => {});

    await act(async () => {
      handlers.release?.(EVT, makeGestureState(100));
      handlers.release?.(EVT, makeGestureState(100));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onPanResponderMove is captured (drag tracking is wired up)", async () => {
    spyOnAnimatedTiming();
    const handlers = spyOnPanResponder();

    render(<JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />);
    await act(async () => {});

    // Move handler must be registered
    expect(handlers.move).toBeDefined();

    // Invoking it inside act should not throw
    await act(async () => {
      handlers.move?.(EVT, makeGestureState(40));
    });
  });
});
