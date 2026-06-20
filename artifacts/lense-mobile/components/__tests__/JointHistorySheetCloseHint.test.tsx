/**
 * Verifies that JointHistorySheet renders the "Tap × to close" backdrop hint
 * and an accessible, prominent close button so athletes on large phones can
 * discover how to dismiss the sheet without accidentally tapping the backdrop.
 *
 * The backdrop itself deliberately has no onPress handler (to prevent
 * accidental dismissal); the hint is a purely visual affordance (pointerEvents
 * = "none") pointing athletes to the explicit × button.
 */

import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";

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

import JointHistorySheet from "@/components/JointHistorySheet";

const SAMPLE_DATA = [
  { analysisId: "a1", date: "2025-01-01", angle: 42, risk: 0 as const, sport: "running" },
  { analysisId: "a2", date: "2025-02-01", angle: 50, risk: 1 as const, sport: "running" },
  { analysisId: "a3", date: "2025-03-01", angle: 38, risk: 2 as const, sport: "running" },
];

describe("JointHistorySheet — close hint and prominent close button", () => {
  it("renders the backdrop-close-hint with 'Tap × to close' text", async () => {
    const { getByTestId, getByText } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />,
    );

    await act(async () => {});

    expect(getByTestId("backdrop-close-hint")).not.toBeNull();
    expect(getByText("Tap × to close")).not.toBeNull();
  });

  it("renders the close button with testID close-button", async () => {
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={jest.fn()} />,
    );

    await act(async () => {});

    expect(getByTestId("close-button")).not.toBeNull();
  });

  it("calls onClose when the close button is pressed", async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    fireEvent.press(getByTestId("close-button"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the backdrop is tapped (accidental dismissal guard)", async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    fireEvent.press(getByTestId("history-sheet-backdrop"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the hint even when there is only one data point", async () => {
    const singlePoint = [SAMPLE_DATA[0]!];
    const { getByTestId } = render(
      <JointHistorySheet joint="leftKnee" data={singlePoint} onClose={jest.fn()} />,
    );

    await act(async () => {});

    expect(getByTestId("backdrop-close-hint")).not.toBeNull();
  });
});
