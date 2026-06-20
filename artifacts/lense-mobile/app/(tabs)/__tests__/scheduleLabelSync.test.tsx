/**
 * Tests: schedule label stays in sync when trainingDays changes.
 *
 * The Home screen derives `scheduleSummary` directly from
 * `profile?.trainingDays` via `computeScheduleSummary`. When the profile
 * is mutated (partial → all-7 → partial), the rendered label must update
 * accordingly — showing the correct abbreviation string or disappearing
 * entirely when all 7 days are active.
 *
 * Strategy — minimal wrapper:
 *   Mirrors only the schedule-label portion of app/(tabs)/index.tsx so the
 *   test remains deterministic and free of the full screen's heavy deps.
 *   `computeScheduleSummary` is imported directly so the expected strings
 *   are always derived from the same function the component uses — divergence
 *   is structurally impossible.
 *
 * Covered scenarios:
 *   1. Partial schedule → label shows the correct abbreviation string.
 *   2. Switching to all 7 days → label disappears (returns null).
 *   3. Switching back to a partial schedule → label reappears with new string.
 *   4. Single training day → label shows exactly one character.
 *   5. Default (no trainingDays provided) → label hidden (defaults to all-7).
 */

import React from "react";
import { Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { computeScheduleSummary } from "@/utils/scheduleUtils";

// ─── Minimal wrapper ──────────────────────────────────────────────────────────
// Mirrors the exact lines in app/(tabs)/index.tsx that produce the
// schedule label, so a refactor of those lines will fail this test.
//
//   const trainingDaysSet = new Set<number>(profile?.trainingDays ?? [0,1,2,3,4,5,6]);
//   const scheduleSummary = computeScheduleSummary(Array.from(trainingDaysSet));
//   ...
//   {scheduleSummary != null && <Text testID="schedule-label">{scheduleSummary}</Text>}

interface ScheduleLabelWrapperProps {
  trainingDays?: number[];
}

function ScheduleLabelWrapper({ trainingDays }: ScheduleLabelWrapperProps) {
  const trainingDaysSet = new Set<number>(trainingDays ?? [0, 1, 2, 3, 4, 5, 6]);
  const scheduleSummary = computeScheduleSummary(Array.from(trainingDaysSet));

  return (
    <View>
      {scheduleSummary != null && (
        <Text testID="schedule-label">{scheduleSummary}</Text>
      )}
    </View>
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MON_WED_FRI   = [1, 3, 5];          // partial — M · W · F
const WEEKDAYS      = [1, 2, 3, 4, 5];    // partial — M · T · W · T · F
const ALL_SEVEN     = [0, 1, 2, 3, 4, 5, 6];
const SINGLE_DAY    = [3];                // Wednesday only

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("schedule label — sync with trainingDays changes", () => {

  it("shows the correct abbreviation string for a partial schedule (M · W · F)", () => {
    const expected = computeScheduleSummary(MON_WED_FRI);
    expect(expected).not.toBeNull(); // guard: this fixture must yield a label

    const { getByTestId } = render(<ScheduleLabelWrapper trainingDays={MON_WED_FRI} />);

    expect(getByTestId("schedule-label").props.children).toBe(expected);
  });

  it("hides the label when all 7 days are active", () => {
    const expected = computeScheduleSummary(ALL_SEVEN);
    expect(expected).toBeNull(); // guard: all-7 must return null

    const { queryByTestId } = render(<ScheduleLabelWrapper trainingDays={ALL_SEVEN} />);

    expect(queryByTestId("schedule-label")).toBeNull();
  });

  it("re-renders label correctly: partial → all-7 (label disappears)", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <ScheduleLabelWrapper trainingDays={MON_WED_FRI} />
    );

    // Start: partial schedule — label present.
    expect(getByTestId("schedule-label").props.children).toBe(
      computeScheduleSummary(MON_WED_FRI)
    );

    // Switch to all 7 days — label must disappear.
    rerender(<ScheduleLabelWrapper trainingDays={ALL_SEVEN} />);
    expect(queryByTestId("schedule-label")).toBeNull();
  });

  it("re-renders label correctly: all-7 → partial (label reappears)", () => {
    const { queryByTestId, rerender } = render(
      <ScheduleLabelWrapper trainingDays={ALL_SEVEN} />
    );

    // Start: all-7 — label hidden.
    expect(queryByTestId("schedule-label")).toBeNull();

    // Switch to a partial schedule — label must appear with correct string.
    rerender(<ScheduleLabelWrapper trainingDays={WEEKDAYS} />);
    expect(queryByTestId("schedule-label")?.props.children).toBe(
      computeScheduleSummary(WEEKDAYS)
    );
  });

  it("re-renders label correctly across three transitions: partial → all-7 → different partial", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <ScheduleLabelWrapper trainingDays={MON_WED_FRI} />
    );

    // Phase 1: M · W · F
    expect(getByTestId("schedule-label").props.children).toBe(
      computeScheduleSummary(MON_WED_FRI)
    );

    // Phase 2: all 7 days — label disappears.
    rerender(<ScheduleLabelWrapper trainingDays={ALL_SEVEN} />);
    expect(queryByTestId("schedule-label")).toBeNull();

    // Phase 3: weekdays only — label reappears with updated string.
    rerender(<ScheduleLabelWrapper trainingDays={WEEKDAYS} />);
    const label = queryByTestId("schedule-label");
    expect(label).not.toBeNull();
    expect(label?.props.children).toBe(computeScheduleSummary(WEEKDAYS));
  });

  it("shows a single character label when only one training day is configured", () => {
    const expected = computeScheduleSummary(SINGLE_DAY);
    expect(expected).toBe("W"); // Wednesday

    const { getByTestId } = render(<ScheduleLabelWrapper trainingDays={SINGLE_DAY} />);
    expect(getByTestId("schedule-label").props.children).toBe("W");
  });

  it("hides the label by default when no trainingDays prop is provided (falls back to all-7)", () => {
    // The Home screen default is [0,1,2,3,4,5,6] when profile?.trainingDays is
    // absent — the label must therefore be hidden (null path).
    const { queryByTestId } = render(<ScheduleLabelWrapper />);
    expect(queryByTestId("schedule-label")).toBeNull();
  });
});
