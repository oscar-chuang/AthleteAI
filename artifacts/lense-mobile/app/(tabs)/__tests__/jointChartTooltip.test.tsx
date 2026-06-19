/**
 * Unit tests: tapping a dot on JointFullChart shows a tooltip with the correct
 * angle, formatted date, and risk label, and the tooltip can be dismissed by a
 * second tap or by the 3-second auto-dismiss timer.
 *
 * Mocking strategy:
 *   - react-native-svg Circle is rendered as a RN Pressable when it has an
 *     onPress prop (the transparent hit-target circle) and as null otherwise
 *     (the visible dot). This lets fireEvent.press reach the handler.
 *   - Svg / Line / Path / Polyline / Text are stubbed to null so the rest of
 *     the SVG rendering doesn't crash in jsdom.
 *   - JointFullChart accepts a `colors` prop directly, so useColors does not
 *     need to be mocked.
 *   - Jest fake timers control the 3-second auto-dismiss.
 *
 * Key assertions:
 *   1. Pressing a dot shows a tooltip with the correct angle, date, and risk.
 *   2. Pressing the same dot again dismisses the tooltip.
 *   3. After 3 000 ms the auto-dismiss timer fires and the tooltip disappears.
 */

import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

// ─── SVG mock — Circle becomes a Pressable when onPress is present ────────────

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    Svg: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    Line: () => null,
    Path: () => null,
    Polyline: () => null,
    Circle: ({ onPress, testID }: { onPress?: () => void; testID?: string }) =>
      onPress
        ? React.createElement(Pressable, {
            onPress,
            testID: testID ?? "dot-hit-target",
          })
        : null,
    Text: () => null,
  };
});

// Import component AFTER mocks are set up.
import { JointFullChart } from "../progress";

// ─── Shared test data ─────────────────────────────────────────────────────────

const MOCK_COLORS = {
  background: "#0a0a0a",
  foreground: "#f5f5f5",
  card: "#1a1a1a",
  border: "#2a2a2a",
  primary: "#6c63ff",
  mutedForeground: "#888888",
  muted: "#333333",
  success: "#22c55e",
  warning: "#f59e0b",
  destructive: "#ff4d6d",
  radius: 12,
} as const;

const MOCK_DATA = [
  { analysisId: "a1", sport: "Running", date: "2024-06-10", angle: 30, risk: 0 as 0 | 1 | 2 },
  { analysisId: "a2", sport: "Running", date: "2024-06-15", angle: 45, risk: 1 as 0 | 1 | 2 },
  { analysisId: "a3", sport: "Running", date: "2024-06-20", angle: 60, risk: 2 as 0 | 1 | 2 },
];

// Compute the expected formatted dates using the same locale logic as the
// component, so the assertions are timezone-agnostic.
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flush pending React state updates. */
async function flush(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("JointFullChart — dot-tap tooltip", () => {
  it("shows the tooltip with angle, date, and risk label when a dot is pressed", async () => {
    const { getAllByTestId, getByText, queryByText } = render(
      <JointFullChart data={MOCK_DATA} width={300} colors={MOCK_COLORS as any} />
    );

    // No tooltip initially.
    expect(queryByText("45.0°")).toBeNull();

    // Tap the second dot's hit target (index 1, angle=45, risk=1 → "Caution").
    const hitTargets = getAllByTestId("dot-hit-target");
    await act(async () => {
      fireEvent.press(hitTargets[1]!);
    });

    // Tooltip must show the angle.
    expect(getByText("45.0°")).toBeTruthy();
    // Tooltip must show the formatted date.
    expect(getByText(fmtDate("2024-06-15"))).toBeTruthy();
    // Tooltip must show the risk label.
    expect(getByText("Caution")).toBeTruthy();
  });

  it("dismisses the tooltip when the same dot is pressed a second time", async () => {
    const { getAllByTestId, getByText, queryByText } = render(
      <JointFullChart data={MOCK_DATA} width={300} colors={MOCK_COLORS as any} />
    );

    const hitTargets = getAllByTestId("dot-hit-target");

    // First press — tooltip appears.
    await act(async () => {
      fireEvent.press(hitTargets[0]!);
    });
    expect(getByText("30.0°")).toBeTruthy();

    // Second press on the same dot — tooltip disappears.
    await act(async () => {
      fireEvent.press(hitTargets[0]!);
    });
    expect(queryByText("30.0°")).toBeNull();
  });

  it("auto-dismisses the tooltip after 3 000 ms", async () => {
    const { getAllByTestId, getByText, queryByText } = render(
      <JointFullChart data={MOCK_DATA} width={300} colors={MOCK_COLORS as any} />
    );

    const hitTargets = getAllByTestId("dot-hit-target");

    // Press a dot to show the tooltip.
    await act(async () => {
      fireEvent.press(hitTargets[2]!);
    });
    expect(getByText("60.0°")).toBeTruthy();
    expect(getByText("High Risk")).toBeTruthy();

    // Advance fake timers by 3 seconds — the auto-dismiss should fire.
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    await flush();

    expect(queryByText("60.0°")).toBeNull();
  });

  it("replaces the tooltip when a different dot is pressed", async () => {
    const { getAllByTestId, getByText, queryByText } = render(
      <JointFullChart data={MOCK_DATA} width={300} colors={MOCK_COLORS as any} />
    );

    const hitTargets = getAllByTestId("dot-hit-target");

    // Press first dot.
    await act(async () => {
      fireEvent.press(hitTargets[0]!);
    });
    expect(getByText("30.0°")).toBeTruthy();
    expect(getByText("Safe")).toBeTruthy();

    // Press a different dot — old tooltip disappears, new one appears.
    await act(async () => {
      fireEvent.press(hitTargets[1]!);
    });
    expect(queryByText("30.0°")).toBeNull();
    expect(getByText("45.0°")).toBeTruthy();
    expect(getByText("Caution")).toBeTruthy();
  });
});
