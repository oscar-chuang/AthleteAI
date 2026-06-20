/**
 * Tests for MovementDimensionHistorySheet.
 *
 * Strategy:
 *  - react-native-svg is mocked so SVG elements render as plain Views / null,
 *    letting testIDs (dimension-dot-hit-target, dimension-tooltip) propagate
 *    into the test tree.
 *  - expo-router useRouter is mocked (the component always calls it).
 *  - @expo/vector-icons Feather is mocked to null.
 *  - jest.useFakeTimers drives the auto-dismiss timer synchronously.
 *  - Animated.timing is spied on to assert correct fade parameters.
 *
 * Scenarios covered:
 *  - Sheet renders with the correct label text
 *  - Empty data shows "No history yet"
 *  - Single session shows "Scan again to see your trend"
 *  - Two or more sessions render chart dots (dimension-dot-hit-target)
 *  - Tapping a dot makes the tooltip appear (dimension-tooltip)
 *  - Tooltip contains the score, band, date, and sport
 *  - Tooltip auto-dismisses after 3 s
 *  - Tapping the same dot again dismisses the tooltip
 *  - Fade-in calls Animated.timing with toValue=1
 *  - Fade-out calls Animated.timing with toValue=0
 *  - Close button (TouchableOpacity) fires onClose
 */

import React from "react";
import { Animated, TouchableOpacity } from "react-native";
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
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

import MovementDimensionHistorySheet from "@/components/MovementDimensionHistorySheet";
import type { MovementSummaryDataPoint } from "@/lib/api";

const noop = () => {};

const ONE_POINT: MovementSummaryDataPoint[] = [
  {
    analysisId: "a1",
    date: "2025-01-15",
    sport: "running",
    flowScore: 72,
    efficiencyScore: 68,
    bodyControlScore: 75,
    consistencyScore: 70,
    rhythmScore: 65,
    overallScore: 70,
  },
];

const THREE_POINTS: MovementSummaryDataPoint[] = [
  {
    analysisId: "a1",
    date: "2025-01-15",
    sport: "running",
    flowScore: 60,
    efficiencyScore: 58,
    bodyControlScore: 62,
    consistencyScore: 57,
    rhythmScore: 55,
    overallScore: 58,
  },
  {
    analysisId: "a2",
    date: "2025-02-10",
    sport: "running",
    flowScore: 72,
    efficiencyScore: 70,
    bodyControlScore: 74,
    consistencyScore: 69,
    rhythmScore: 67,
    overallScore: 70,
  },
  {
    analysisId: "a3",
    date: "2025-03-05",
    sport: "swimming",
    flowScore: 80,
    efficiencyScore: 78,
    bodyControlScore: 82,
    consistencyScore: 77,
    rhythmScore: 75,
    overallScore: 78,
  },
];

function spyAnimatedTiming() {
  const original = Animated.timing.bind(Animated);
  const calls: Parameters<typeof Animated.timing>[] = [];
  const spy = jest
    .spyOn(Animated, "timing")
    .mockImplementation((...args: Parameters<typeof Animated.timing>) => {
      calls.push(args);
      return original(...args);
    });
  return { calls, spy };
}

describe("MovementDimensionHistorySheet — label and color", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the dimension label text in the header", () => {
    const { getByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    expect(getByText("Flow")).toBeTruthy();
  });

  it("renders the latest score value in the header", () => {
    const { getByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    expect(getByText("80")).toBeTruthy();
  });

  it("renders the correct score band for the latest value", () => {
    const { getByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    expect(getByText("Advanced")).toBeTruthy();
  });

  it("applies the color prop to the latest score text", () => {
    const { getAllByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const scoreNodes = getAllByText("80");
    const coloredScore = scoreNodes.find((node) => {
      const s = node.props.style;
      if (!s) return false;
      const styles = Array.isArray(s) ? s : [s];
      return styles.some((st: Record<string, unknown>) => st?.color === "#00C2FF");
    });
    expect(coloredScore).toBeDefined();
  });
});

describe("MovementDimensionHistorySheet — empty and single-session states", () => {
  it('shows "No history yet" when data is empty', () => {
    const { getByText, queryByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={[]}
        onClose={noop}
      />,
    );

    expect(getByText("No history yet")).toBeTruthy();
    expect(queryByText("Scan again to see your trend")).toBeNull();
  });

  it('shows "Scan again to see your trend" for a single session', () => {
    const { getByText, queryByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={ONE_POINT}
        onClose={noop}
      />,
    );

    expect(getByText("Scan again to see your trend")).toBeTruthy();
    expect(queryByText("No history yet")).toBeNull();
  });

  it("single-session view shows the score and band inside the fallback card", () => {
    const { getAllByText, getByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={ONE_POINT}
        onClose={noop}
      />,
    );

    expect(getAllByText("72").length).toBeGreaterThan(0);
    expect(getAllByText("Advanced").length).toBeGreaterThan(0);
  });
});

describe("MovementDimensionHistorySheet — chart rendering", () => {
  it("renders dot hit-targets when there are two or more sessions", () => {
    const { getAllByTestId, queryByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    expect(dots.length).toBe(THREE_POINTS.length);

    expect(queryByText("Scan again to see your trend")).toBeNull();
    expect(queryByText("No history yet")).toBeNull();
  });

  it("tooltip is not present on initial render", () => {
    const { queryByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    expect(queryByTestId("dimension-tooltip")).toBeNull();
  });
});

describe("MovementDimensionHistorySheet — tooltip content", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("shows the tooltip after tapping a dot", async () => {
    const { getAllByTestId, getByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    expect(getByTestId("dimension-tooltip")).toBeTruthy();
  });

  it("tooltip shows the rounded score for the tapped session", async () => {
    const { getAllByTestId, getByTestId, getAllByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    expect(getByTestId("dimension-tooltip")).toBeTruthy();
    expect(getAllByText("60").length).toBeGreaterThan(0);
  });

  it("tooltip shows the score band for the tapped session", async () => {
    const { getAllByTestId, getAllByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    expect(getAllByText("Proficient").length).toBeGreaterThan(0);
  });

  it("tooltip shows the formatted date and sport for the tapped session", async () => {
    const { getAllByTestId, getByText } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[2]!);
    });

    expect(getByText("Mar 5 · Swimming")).toBeTruthy();
  });

  it("tapping the same dot again dismisses the tooltip", async () => {
    const { getAllByTestId, queryByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    await act(async () => {
      fireEvent.press(dots[0]!);
      jest.runAllTimers();
    });

    expect(queryByTestId("dimension-tooltip")).toBeNull();
  });

  it("auto-dismisses the tooltip after 3 s", async () => {
    const { getAllByTestId, queryByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[1]!);
    });

    expect(queryByTestId("dimension-tooltip")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(queryByTestId("dimension-tooltip")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1);
      jest.runAllTimers();
    });

    expect(queryByTestId("dimension-tooltip")).toBeNull();
  });
});

describe("MovementDimensionHistorySheet — animation parameters", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("calls Animated.timing with toValue=1 and duration≤300 for fade-in", async () => {
    const { calls } = spyAnimatedTiming();

    const { getAllByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");
    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    const fadeIn = calls.find(([, cfg]) => (cfg as { toValue: number }).toValue === 1);
    expect(fadeIn).toBeDefined();
    const config = fadeIn![1] as { toValue: number; duration: number; useNativeDriver: boolean };
    expect(config.toValue).toBe(1);
    expect(config.duration).toBeLessThanOrEqual(300);
    expect(config.useNativeDriver).toBe(true);
  });

  it("calls Animated.timing with toValue=0 and duration≤300 for fade-out", async () => {
    const { calls } = spyAnimatedTiming();

    const { getAllByTestId } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={noop}
      />,
    );

    const dots = getAllByTestId("dimension-dot-hit-target");

    await act(async () => {
      fireEvent.press(dots[0]!);
    });

    await act(async () => {
      fireEvent.press(dots[0]!);
      jest.runAllTimers();
    });

    const fadeOut = calls.find(([, cfg]) => (cfg as { toValue: number }).toValue === 0);
    expect(fadeOut).toBeDefined();
    const config = fadeOut![1] as { toValue: number; duration: number; useNativeDriver: boolean };
    expect(config.toValue).toBe(0);
    expect(config.duration).toBeLessThanOrEqual(300);
    expect(config.useNativeDriver).toBe(true);
  });
});

describe("MovementDimensionHistorySheet — close button", () => {
  afterEach(() => jest.restoreAllMocks());

  it("calls onClose when the close button (TouchableOpacity) is pressed", async () => {
    const onClose = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <MovementDimensionHistorySheet
        dimensionKey="flowScore"
        label="Flow"
        color="#00C2FF"
        data={THREE_POINTS}
        onClose={onClose}
      />,
    );

    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(touchables[0]!);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
