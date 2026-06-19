/**
 * Component test: WeekDotRow correctly renders rest days as greyed-out
 * (opacity 0.45 + dash indicator) and never as missed days.
 *
 * Strategy:
 *   - Use a fixed reference date (2024-01-08, Monday) so day-of-week indices
 *     are deterministic.
 *   - Mount WeekDotRow directly via RNTL — no full-page mocking needed.
 *   - Query rendered Views/Texts by testID and assert style props.
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { WeekDotRow } from "@/components/WeekDotRow";

// ─── Constants ────────────────────────────────────────────────────────────────

// 2024-01-08 is a Monday (getDay() === 1).
// The 7-day window ends on this day:
//   Mon 01 · Tue 02 · Wed 03 · Thu 04 · Fri 05 · Sat 06 · Sun 07 · Mon 08
//   (oldest first, offset -6 … 0)
const TODAY = "2024-01-08"; // Monday

/** Build the same lastSevenDays array the Home screen computes. */
function makeWindow(todayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr + "T12:00:00");
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0]!;
  });
}

const LAST_SEVEN = makeWindow(TODAY);
// LAST_SEVEN = ["2024-01-02","2024-01-03","2024-01-04","2024-01-05","2024-01-06","2024-01-07","2024-01-08"]
// day-of-week:          Tue=2       Wed=3       Thu=4       Fri=5       Sat=6       Sun=0       Mon=1

const SUNDAY = "2024-01-07"; // getDay() === 0 — rest day when 0 excluded
const MONDAY = "2024-01-08"; // getDay() === 1 — today, training day
const SATURDAY = "2024-01-06"; // getDay() === 6 — training day, past, no session → missed

/** Minimal colour tokens — values chosen to be unique so we can spot them in styles. */
const COLORS = {
  primary: "#6c63ff",
  border: "#2a2a2a",
  mutedForeground: "#888888",
  warning: "#f59e0b",
};

/** Training schedule that excludes Sunday (0). */
const SCHEDULE_NO_SUNDAY = new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat
/** Schedule that includes all days. */
const SCHEDULE_ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderRow({
  trainedOn = new Set<string>(),
  trainingDays = SCHEDULE_ALL_DAYS,
  goalReached = false,
}: {
  trainedOn?: Set<string>;
  trainingDays?: Set<number>;
  goalReached?: boolean;
}) {
  return render(
    <WeekDotRow
      lastSevenDays={LAST_SEVEN}
      todayStr={TODAY}
      trainedDaysSet={trainedOn}
      trainingDaysSet={trainingDays}
      goalReached={goalReached}
      colors={COLORS}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WeekDotRow — rest days are greyed out, not missed", () => {
  it("renders seven day-dot containers", () => {
    const { getByTestId } = renderRow({});
    // Spot-check a few — all seven must exist.
    for (const day of LAST_SEVEN) {
      expect(getByTestId(`day-dot-${day}`)).toBeTruthy();
    }
  });

  it("rest-day circle has opacity 0.45", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SUNDAY}`);
    expect(circle.props.style).toMatchObject({ opacity: 0.45 });
  });

  it("rest-day circle has the greyed background (border + alpha suffix), not transparent", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SUNDAY}`);
    expect(circle.props.style).toMatchObject({
      backgroundColor: COLORS.border + "44",
    });
  });

  it("rest-day circle has zero borderWidth (no outlined-missing style)", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SUNDAY}`);
    expect(circle.props.style).toMatchObject({ borderWidth: 0 });
  });

  it("rest-day circle shows the dash indicator (horizontal bar inside)", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    expect(getByTestId(`day-dot-dash-${SUNDAY}`)).toBeTruthy();
  });

  it("rest-day circle does NOT show the missed warning border colour", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SUNDAY}`);
    const borderColor: string = circle.props.style.borderColor ?? "";
    expect(borderColor).not.toContain(COLORS.warning);
  });

  it("rest-day circle does NOT show a today-pip indicator", () => {
    // Sunday is not today in our window, but also verify no pip is rendered.
    const { queryByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    expect(queryByTestId(`day-dot-today-pip-${SUNDAY}`)).toBeNull();
  });

  it("a missed scheduled day has opacity 1 (not greyed out like a rest day)", () => {
    // Saturday is in the schedule but the user didn't train → status = missed.
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SATURDAY}`);
    expect(circle.props.style).toMatchObject({ opacity: 1 });
  });

  it("a missed scheduled day does NOT show the dash indicator", () => {
    const { queryByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    expect(queryByTestId(`day-dot-dash-${SATURDAY}`)).toBeNull();
  });

  it("a missed scheduled day has the warning border colour", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_NO_SUNDAY });
    const circle = getByTestId(`day-dot-circle-${SATURDAY}`);
    expect(circle.props.style).toMatchObject({
      borderColor: COLORS.warning + "88",
    });
  });

  it("when every weekday is scheduled, no day renders as rest", () => {
    const { queryByTestId } = renderRow({ trainingDays: SCHEDULE_ALL_DAYS });
    // None of the 7 days should have a dash indicator.
    for (const day of LAST_SEVEN) {
      expect(queryByTestId(`day-dot-dash-${day}`)).toBeNull();
    }
  });

  it("trained day has opacity 1 regardless of rest-day schedule", () => {
    // User trained on Sunday even though it is a rest day → status = trained.
    const { getByTestId } = renderRow({
      trainedOn: new Set([SUNDAY]),
      trainingDays: SCHEDULE_NO_SUNDAY,
    });
    const circle = getByTestId(`day-dot-circle-${SUNDAY}`);
    expect(circle.props.style).toMatchObject({ opacity: 1 });
  });

  it("trained rest day does NOT render a dash indicator", () => {
    const { queryByTestId } = renderRow({
      trainedOn: new Set([SUNDAY]),
      trainingDays: SCHEDULE_NO_SUNDAY,
    });
    expect(queryByTestId(`day-dot-dash-${SUNDAY}`)).toBeNull();
  });

  it("today dot (no session, scheduled) renders with opacity 1 and a pip", () => {
    const { getByTestId } = renderRow({ trainingDays: SCHEDULE_ALL_DAYS });
    const circle = getByTestId(`day-dot-circle-${MONDAY}`);
    expect(circle.props.style).toMatchObject({ opacity: 1 });
    expect(getByTestId(`day-dot-today-pip-${MONDAY}`)).toBeTruthy();
  });

  it("today label uses primary color even when the user has already trained today", () => {
    // Regression guard: status becomes 'trained' for a session on today's date,
    // but the day label should still render in primary (not muted) because
    // the date is still today.
    const { getByTestId } = renderRow({
      trainedOn: new Set([MONDAY]),
      trainingDays: SCHEDULE_ALL_DAYS,
    });
    const label = getByTestId(`day-label-${MONDAY}`);
    expect(label.props.style).toMatchObject({ color: COLORS.primary });
  });

  it("today trained dot has no pip (user has already completed the session)", () => {
    const { queryByTestId } = renderRow({
      trainedOn: new Set([MONDAY]),
      trainingDays: SCHEDULE_ALL_DAYS,
    });
    expect(queryByTestId(`day-dot-today-pip-${MONDAY}`)).toBeNull();
  });
});
