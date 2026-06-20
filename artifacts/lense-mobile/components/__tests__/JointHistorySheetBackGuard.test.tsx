/**
 * Verifies that the Android hardware back-press guard in JointHistorySheet
 * prevents double-dismiss when onRequestClose fires twice in rapid succession.
 *
 * Strategy:
 *  - Render JointHistorySheet directly (not through ProgressScreen).
 *  - Retrieve the Modal element via UNSAFE_getByType and call its
 *    onRequestClose prop twice synchronously — this simulates a rapid
 *    double back-swipe on Android.
 *  - Assert that the parent onClose callback was invoked exactly once.
 */

import React from "react";
import { Modal } from "react-native";
import { render, act } from "@testing-library/react-native";

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
];

describe("JointHistorySheet — Android back-press guard", () => {
  it("calls onClose exactly once even when onRequestClose fires twice rapidly", async () => {
    const onClose = jest.fn();

    const { UNSAFE_getByType } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    const modal = UNSAFE_getByType(Modal);
    const onRequestClose: (() => void) | undefined = modal.props.onRequestClose;

    expect(onRequestClose).toBeDefined();

    act(() => {
      onRequestClose!();
      onRequestClose!();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose once when onRequestClose fires one time", async () => {
    const onClose = jest.fn();

    const { UNSAFE_getByType } = render(
      <JointHistorySheet joint="leftKnee" data={SAMPLE_DATA} onClose={onClose} />,
    );

    await act(async () => {});

    const modal = UNSAFE_getByType(Modal);
    const onRequestClose: (() => void) | undefined = modal.props.onRequestClose;

    act(() => {
      onRequestClose!();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
