/**
 * Verifies that tapping a tooltip in JointHistorySheet navigates to the
 * correct analysis screen and calls onClose first.
 *
 * Strategy:
 *  - react-native-svg is mocked so Circle renders as a plain View, allowing
 *    testIDs (dot-hit-target, tooltip-pressable) to appear in the test tree.
 *  - expo-router is mocked so useRouter returns a controlled push spy.
 *  - We track call order via a shared order array to verify onClose fires
 *    before router.push.
 *  - We press the inner Pressable (testID="tooltip-pressable") rather than the
 *    outer Animated.View (testID="joint-tooltip") because only the Pressable
 *    carries the onPress handler.
 */

import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: View,
    Svg: View,
    G: View,
    Rect: () => null,
    Circle: View,
    Polyline: () => null,
    Path: () => null,
    Line: () => null,
    Text: () => null,
  };
});

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import JointHistorySheet from "@/components/JointHistorySheet";

const ANALYSIS_ID = "session-abc-123";

const SAMPLE_DATA = [
  { analysisId: "prev-session-1", date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
  { analysisId: "prev-session-2", date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
  { analysisId: ANALYSIS_ID,       date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
];

describe("JointHistorySheet — tooltip navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("calls router.push with the correct analysis path when the tooltip is tapped", async () => {
    const onClose = jest.fn();

    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[2]!);
    });

    const pressable = getByTestId("tooltip-pressable");
    await act(async () => {
      fireEvent.press(pressable);
    });

    expect(mockPush).toHaveBeenCalledWith(`/analysis/skeleton/${ANALYSIS_ID}`);
  });

  it("calls onClose before router.push when the tooltip is tapped", async () => {
    const order: string[] = [];
    const onClose = jest.fn(() => order.push("onClose"));
    mockPush.mockImplementation(() => order.push("push"));

    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[2]!);
    });

    const pressable = getByTestId("tooltip-pressable");
    await act(async () => {
      fireEvent.press(pressable);
    });

    expect(order).toEqual(["onClose", "push"]);
  });

  it("calls router.push exactly once per tooltip tap", async () => {
    const onClose = jest.fn();

    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[2]!);
    });

    const pressable = getByTestId("tooltip-pressable");
    await act(async () => {
      fireEvent.press(pressable);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("navigates to the correct path for any data point with an analysisId", async () => {
    const onClose = jest.fn();

    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    const dots = getAllByTestId("dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    const pressable = getByTestId("tooltip-pressable");
    await act(async () => {
      fireEvent.press(pressable);
    });

    expect(mockPush).toHaveBeenCalledWith(`/analysis/skeleton/${SAMPLE_DATA[0]!.analysisId}`);
  });

  it("does not call router.push when tapping a tooltip for a data point with no analysisId", async () => {
    const onClose = jest.fn();
    const dataWithoutId = [
      { analysisId: "has-id",  date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
      { analysisId: "",        date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
      { analysisId: "has-id2", date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
    ];

    const { getAllByTestId, getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={dataWithoutId} onClose={onClose} />,
    );

    const dots = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[1]!);
    });

    const pressable = getByTestId("tooltip-pressable");
    await act(async () => {
      fireEvent.press(pressable);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
