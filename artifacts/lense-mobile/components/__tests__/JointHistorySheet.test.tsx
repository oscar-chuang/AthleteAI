/**
 * Verifies the empty-state, chart rendering, and current-session highlight
 * behaviour of JointHistorySheet.
 *
 * Strategy:
 *  - react-native-svg is mocked so SVG elements render as plain Views /
 *    return null, keeping the test tree simple.
 *  - expo-router useRouter is mocked (the component always calls it).
 *  - Scenarios tested:
 *      0 items  → "No history yet" is visible
 *      1 item   → "Scan again to see your trend" is visible
 *      2+ items → the chart Pressable (testID="joint-history-chart") is
 *                 rendered and neither empty-state message appears
 *      currentAnalysisId matches a data point → "This session" legend appears
 *                 (isCurrent = true for that dot → purple glow ring + legend)
 *      no currentAnalysisId supplied → "Latest" legend appears instead
 *      currentAnalysisId not found in data → neither legend appears
 */

import React from "react";
import { render } from "@testing-library/react-native";

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

import JointHistorySheet from "@/components/JointHistorySheet";

const noop = () => {};

const ONE_POINT = [
  { analysisId: "a1", date: "2025-01-01", angle: 45, risk: 0 as const, sport: "running" },
];

const TWO_POINTS = [
  { analysisId: "a1", date: "2025-01-01", angle: 45, risk: 0 as const, sport: "running" },
  { analysisId: "a2", date: "2025-02-01", angle: 52, risk: 1 as const, sport: "running" },
];

describe("JointHistorySheet — empty state rendering", () => {
  it('shows "No history yet" when data is empty', () => {
    const { getByText, queryByText, queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={[]} onClose={noop} />,
    );

    expect(getByText("No history yet")).toBeTruthy();
    expect(queryByText("Scan again to see your trend")).toBeNull();
    expect(queryByTestId("joint-history-chart")).toBeNull();
  });

  it('shows "Scan again to see your trend" when there is exactly one data point', () => {
    const { getByText, queryByText, queryByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={ONE_POINT} onClose={noop} />,
    );

    expect(getByText("Scan again to see your trend")).toBeTruthy();
    expect(queryByText("No history yet")).toBeNull();
    expect(queryByTestId("joint-history-chart")).toBeNull();
  });

  it("renders the chart and no empty-state message when there are two or more data points", () => {
    const { getByTestId, queryByText } = render(
      <JointHistorySheet joint="leftKnee" data={TWO_POINTS} onClose={noop} />,
    );

    expect(getByTestId("joint-history-chart")).toBeTruthy();
    expect(queryByText("Scan again to see your trend")).toBeNull();
    expect(queryByText("No history yet")).toBeNull();
  });
});

describe("JointHistorySheet — isCurrent dot / current-session legend", () => {
  it('shows "This session" legend when currentAnalysisId matches a data point', () => {
    const { getByText, queryByText } = render(
      <JointHistorySheet
        joint="leftKnee"
        data={TWO_POINTS}
        currentAnalysisId="a1"
        onClose={noop}
      />,
    );

    expect(getByText("This session")).toBeTruthy();
    expect(queryByText("Latest")).toBeNull();
  });

  it('shows "Latest" legend when no currentAnalysisId is supplied', () => {
    const { getByText, queryByText } = render(
      <JointHistorySheet joint="leftKnee" data={TWO_POINTS} onClose={noop} />,
    );

    expect(getByText("Latest")).toBeTruthy();
    expect(queryByText("This session")).toBeNull();
  });

  it("shows no current-session legend when currentAnalysisId is not found in data", () => {
    const { queryByText } = render(
      <JointHistorySheet
        joint="leftKnee"
        data={TWO_POINTS}
        currentAnalysisId="unknown-id"
        onClose={noop}
      />,
    );

    expect(queryByText("This session")).toBeNull();
    expect(queryByText("Latest")).toBeNull();
  });
});
