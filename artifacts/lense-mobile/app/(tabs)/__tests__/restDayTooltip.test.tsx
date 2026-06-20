/**
 * Unit tests: rest-day tooltip show/hide lifecycle.
 *
 * Strategy:
 *   - Mount a minimal wrapper component that mirrors the exact tooltip
 *     state + effect + dismiss logic from the Home screen.
 *   - AsyncStorage is auto-mocked via moduleNameMapper in jest.config.js
 *     (points to the library's own jest mock, which is a real in-memory store).
 *   - Five scenarios are covered:
 *       1. Tooltip appears when trainingDays < 7 and the dismissed key is absent.
 *       2. Pressing the dismiss button hides the tooltip and writes the key.
 *       3. Tooltip stays hidden when the key is already set.
 *       4. Tooltip does NOT reappear after dismiss when switching to a different partial schedule.
 *       5. Tooltip DOES appear when switching from all-days to a partial schedule (key never set).
 */

import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Minimal wrapper component ─────────────────────────────────────────────────
// Mirrors only the tooltip-relevant state and effects from app/(tabs)/index.tsx.

interface TooltipWrapperProps {
  trainingDays: number[];
}

function TooltipWrapper({ trainingDays }: TooltipWrapperProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const trainingDaysKey = trainingDays.join(",");

  useEffect(() => {
    const hasRestDays = trainingDays.length < 7;
    if (!hasRestDays) return;
    AsyncStorage.getItem("rest_day_tooltip_dismissed")
      .then((val) => {
        if (!val) setShowTooltip(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDaysKey]);

  const dismiss = useCallback(async () => {
    setShowTooltip(false);
    await AsyncStorage.setItem("rest_day_tooltip_dismissed", "true").catch(() => {});
  }, []);

  return (
    <View>
      {showTooltip && (
        <View testID="rest-day-tooltip">
          <Text>Grey = rest day (not in your schedule)</Text>
          <TouchableOpacity testID="rest-day-tooltip-dismiss" onPress={dismiss}>
            <Text>×</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_WITH_REST = [1, 2, 3, 4, 5, 6]; // Mon–Sat, Sunday excluded → 6 days
const ALL_DAYS       = [0, 1, 2, 3, 4, 5, 6]; // All 7 days, no rest days

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rest-day tooltip — show/hide lifecycle", () => {
  beforeEach(async () => {
    // Reset in-memory AsyncStorage mock between tests.
    await AsyncStorage.clear();
  });

  it("shows the tooltip when trainingDays < 7 and the dismissed key is not set", async () => {
    const { getByTestId } = render(<TooltipWrapper trainingDays={DAYS_WITH_REST} />);

    await waitFor(() => {
      expect(getByTestId("rest-day-tooltip")).toBeTruthy();
    });
  });

  it("hides the tooltip and writes the dismissed key when the dismiss button is pressed", async () => {
    const { getByTestId, queryByTestId } = render(
      <TooltipWrapper trainingDays={DAYS_WITH_REST} />,
    );

    // Wait for tooltip to appear.
    await waitFor(() => {
      expect(getByTestId("rest-day-tooltip")).toBeTruthy();
    });

    // Press the dismiss button.
    await act(async () => {
      fireEvent.press(getByTestId("rest-day-tooltip-dismiss"));
    });

    // Tooltip must be gone.
    expect(queryByTestId("rest-day-tooltip")).toBeNull();

    // AsyncStorage must have the dismissed key set to "true".
    const stored = await AsyncStorage.getItem("rest_day_tooltip_dismissed");
    expect(stored).toBe("true");
  });

  it("does not show the tooltip when the dismissed key is already set", async () => {
    // Pre-set the key before mounting.
    await AsyncStorage.setItem("rest_day_tooltip_dismissed", "true");

    const { queryByTestId } = render(<TooltipWrapper trainingDays={DAYS_WITH_REST} />);

    // Give the effect time to resolve.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(queryByTestId("rest-day-tooltip")).toBeNull();
  });

  it("does not show the tooltip when all 7 days are training days (no rest days)", async () => {
    const { queryByTestId } = render(<TooltipWrapper trainingDays={ALL_DAYS} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(queryByTestId("rest-day-tooltip")).toBeNull();
  });

  it("does not reappear after dismiss when the training schedule changes to a different partial schedule", async () => {
    // Scenario: user has a partial schedule, sees and dismisses the tooltip,
    // then switches to a *different* partial schedule. The key is already set,
    // so the tooltip must stay hidden even though trainingDaysKey changed.
    const DAYS_ALT = [1, 2, 3, 4, 5]; // Mon–Fri, 5 days — a different partial schedule

    const { getByTestId, queryByTestId, rerender } = render(
      <TooltipWrapper trainingDays={DAYS_WITH_REST} />,
    );

    // Wait for the tooltip to appear on the initial partial schedule.
    await waitFor(() => {
      expect(getByTestId("rest-day-tooltip")).toBeTruthy();
    });

    // Dismiss the tooltip — this writes the key to AsyncStorage.
    await act(async () => {
      fireEvent.press(getByTestId("rest-day-tooltip-dismiss"));
    });

    expect(queryByTestId("rest-day-tooltip")).toBeNull();

    // Switch to a different partial schedule — trainingDaysKey changes.
    await act(async () => {
      rerender(<TooltipWrapper trainingDays={DAYS_ALT} />);
    });

    // Give the effect time to resolve.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Tooltip must NOT reappear because the dismissed key is still set.
    expect(queryByTestId("rest-day-tooltip")).toBeNull();
  });

  it("shows the tooltip when switching from all-days to a partial schedule (key was never set)", async () => {
    // Scenario: user starts with all 7 training days (no rest days), so the
    // tooltip effect never fires and the dismissed key is never written.
    // They then remove a day, creating a rest day. The tooltip should appear.
    const { queryByTestId, getByTestId, rerender } = render(
      <TooltipWrapper trainingDays={ALL_DAYS} />,
    );

    // Give the effect time to resolve — tooltip must NOT appear for all-days.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(queryByTestId("rest-day-tooltip")).toBeNull();

    // Verify the dismissed key was never written.
    const keyBeforeSwitch = await AsyncStorage.getItem("rest_day_tooltip_dismissed");
    expect(keyBeforeSwitch).toBeNull();

    // Now switch to a partial schedule.
    await act(async () => {
      rerender(<TooltipWrapper trainingDays={DAYS_WITH_REST} />);
    });

    // The tooltip must appear because the key is absent and rest days now exist.
    await waitFor(() => {
      expect(getByTestId("rest-day-tooltip")).toBeTruthy();
    });
  });
});
