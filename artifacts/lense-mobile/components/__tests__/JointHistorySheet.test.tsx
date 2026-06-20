/**
 * Verifies the empty-state and chart rendering behaviour of JointHistorySheet
 * based on the number of data points supplied.
 *
 * Strategy:
 *  - react-native-svg is mocked so SVG elements render as plain Views /
 *    return null, keeping the test tree simple.
 *  - expo-router useRouter is mocked (the component always calls it).
 *  - Three scenarios are tested:
 *      0 items  → "No history yet" is visible
 *      1 item   → "Scan again to see your trend" is visible
 *      2+ items → the chart Pressable (testID="joint-history-chart") is
 *                 rendered and neither empty-state message appears
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
