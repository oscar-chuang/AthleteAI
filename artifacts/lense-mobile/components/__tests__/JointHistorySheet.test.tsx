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
import { render, within } from "@testing-library/react-native";

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

  it("displays the correct angle value inside the single-scan card", () => {
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={ONE_POINT} onClose={noop} />,
    );

    // Scope to the single-scan block so we confirm the prominent display — not
    // just any matching text that might come from the header.
    const card = getByTestId("single-scan-state");
    expect(within(card).getByText("45°")).toBeTruthy();
  });

  it("displays the correct risk label inside the single-scan card (Safe)", () => {
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={ONE_POINT} onClose={noop} />,
    );

    // Scope to the single-scan block — the risk legend always renders "Safe" /
    // "Caution" / "High Risk" too, so we must assert inside the card specifically.
    const card = getByTestId("single-scan-state");
    expect(within(card).getByText("Safe")).toBeTruthy();
  });

  it("displays Caution label inside the single-scan card for risk level 1", () => {
    const cautionPoint = [
      { analysisId: "b1", date: "2025-03-01", angle: 72, risk: 1 as const, sport: "cycling" },
    ];
    const { getByTestId } = render(
      <JointHistorySheet joint="rightKnee" data={cautionPoint} onClose={noop} />,
    );

    const card = getByTestId("single-scan-state");
    expect(within(card).getByText("72°")).toBeTruthy();
    expect(within(card).getByText("Caution")).toBeTruthy();
  });

  it("displays High Risk label inside the single-scan card for risk level 2", () => {
    const highRiskPoint = [
      { analysisId: "c1", date: "2025-04-01", angle: 30, risk: 2 as const, sport: "tennis" },
    ];
    const { getByTestId } = render(
      <JointHistorySheet joint="leftHip" data={highRiskPoint} onClose={noop} />,
    );

    const card = getByTestId("single-scan-state");
    expect(within(card).getByText("30°")).toBeTruthy();
    expect(within(card).getByText("High Risk")).toBeTruthy();
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
