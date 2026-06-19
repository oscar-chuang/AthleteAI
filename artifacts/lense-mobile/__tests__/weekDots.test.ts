import { describe, it, expect } from "vitest";
import { classifyWeekDots, type DayDot } from "../utils/weekDots";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Set<number> of training days from weekday indices (0=Sun…6=Sat). */
function trainingDays(...days: number[]): Set<number> {
  return new Set(days);
}

/** Build a Set<string> of dates on which sessions were completed. */
function trainedOn(...dates: string[]): Set<string> {
  return new Set(dates);
}

/** All seven weekdays scheduled (Mon–Sun). */
const ALL_DAYS = trainingDays(0, 1, 2, 3, 4, 5, 6);

/**
 * Return a window of 7 consecutive ISO date strings starting `offsetFromToday`
 * days before today and ending on `todayStr`.
 */
function makeWindow(todayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStr + "T12:00:00");
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0]!;
  });
}

function statusOf(dots: DayDot[], dateStr: string) {
  return dots.find((d) => d.dateStr === dateStr)?.status;
}

// ── Rest-day classification ───────────────────────────────────────────────────

describe("rest days", () => {
  it("marks a past day as 'rest' when its weekday is not in trainingDaysSet", () => {
    // Use a known Monday as "today" so we can target a specific prior day.
    // 2024-01-08 is a Monday (getDay() === 1).
    const today = "2024-01-08";
    const window = makeWindow(today);

    // 2024-01-07 is Sunday (getDay() === 0).
    const sunday = "2024-01-07";

    // Exclude Sunday (0) from training schedule.
    const schedule = trainingDays(1, 2, 3, 4, 5, 6); // Mon–Sat only

    const dots = classifyWeekDots(window, today, trainedOn(), schedule);
    expect(statusOf(dots, sunday)).toBe("rest");
  });

  it("marks a rest day as 'rest' even when the user trained on that day", () => {
    const today = "2024-01-08"; // Monday
    const window = makeWindow(today);
    const sunday = "2024-01-07";

    // Sunday is NOT in the training schedule …
    const schedule = trainingDays(1, 2, 3, 4, 5, 6);
    // … but the user happened to train on Sunday anyway
    const trained = trainedOn(sunday);

    const dots = classifyWeekDots(window, today, trained, schedule);
    // "trained" wins over "rest" (the user did train).
    expect(statusOf(dots, sunday)).toBe("trained");
  });

  it("does NOT mark a rest day as 'missed'", () => {
    const today = "2024-01-08"; // Monday
    const window = makeWindow(today);

    // Exclude Sunday (0) from training schedule.
    const schedule = trainingDays(1, 2, 3, 4, 5, 6);

    const dots = classifyWeekDots(window, today, trainedOn(), schedule);

    // Every past day should be either 'rest' or 'trained', never 'missed',
    // for the days that are not scheduled.
    const pastRestDays = dots.filter((d) => d.dateStr < today && !schedule.has(d.dayIdx));
    for (const dot of pastRestDays) {
      expect(dot.status).toBe("rest");
      expect(dot.status).not.toBe("missed");
    }
  });

  it("marks multiple rest days correctly across the 7-day window", () => {
    // 2024-01-12 is a Friday.
    // Window: Sat 6 · Sun 0 · Mon 1 · Tue 2 · Wed 3 · Thu 4 · Fri 5
    const today = "2024-01-12";
    const window = makeWindow(today);

    // Schedule: Mon–Fri only (1–5). Sat (6) and Sun (0) are rest days.
    const schedule = trainingDays(1, 2, 3, 4, 5);

    const dots = classifyWeekDots(window, today, trainedOn(), schedule);

    const sat = "2024-01-06"; // getDay() === 6
    const sun = "2024-01-07"; // getDay() === 0

    expect(statusOf(dots, sat)).toBe("rest");
    expect(statusOf(dots, sun)).toBe("rest");
  });

  it("returns 'rest' for today when it is a rest day and the user has not trained", () => {
    // 2024-01-07 is a Sunday.
    const today = "2024-01-07";
    const window = makeWindow(today);

    // Sunday (0) is excluded from the schedule.
    const schedule = trainingDays(1, 2, 3, 4, 5, 6);

    const dots = classifyWeekDots(window, today, trainedOn(), schedule);
    expect(statusOf(dots, today)).toBe("rest");
  });
});

// ── Missed-day classification ─────────────────────────────────────────────────

describe("missed days", () => {
  it("marks a past scheduled day with no session as 'missed'", () => {
    const today = "2024-01-08"; // Monday
    const window = makeWindow(today);

    // All days are scheduled; user trained on none of the past days.
    const dots = classifyWeekDots(window, today, trainedOn(), ALL_DAYS);

    // Every day before today should be 'missed'.
    const past = dots.filter((d) => d.dateStr < today);
    for (const dot of past) {
      expect(dot.status).toBe("missed");
    }
  });

  it("does NOT mark a rest day as 'missed' even when the user skipped it", () => {
    const today = "2024-01-08"; // Monday
    const window = makeWindow(today);
    const sunday = "2024-01-07"; // getDay() === 0

    // Sunday excluded from the training schedule.
    const schedule = trainingDays(1, 2, 3, 4, 5, 6);

    const dots = classifyWeekDots(window, today, trainedOn(), schedule);
    expect(statusOf(dots, sunday)).not.toBe("missed");
  });
});

// ── Trained-day classification ────────────────────────────────────────────────

describe("trained days", () => {
  it("marks a past day with a session as 'trained' regardless of schedule", () => {
    const today = "2024-01-08"; // Monday
    const window = makeWindow(today);
    const saturday = "2024-01-06"; // getDay() === 6

    // Saturday is NOT scheduled, but the user trained anyway.
    const schedule = trainingDays(1, 2, 3, 4, 5);
    const trained = trainedOn(saturday);

    const dots = classifyWeekDots(window, today, trained, schedule);
    expect(statusOf(dots, saturday)).toBe("trained");
  });
});

// ── Today / future classification ─────────────────────────────────────────────

describe("today and future days", () => {
  it("marks today as 'today' when it is a scheduled day and no session exists yet", () => {
    const today = "2024-01-08"; // Monday — scheduled
    const window = makeWindow(today);

    const dots = classifyWeekDots(window, today, trainedOn(), ALL_DAYS);
    expect(statusOf(dots, today)).toBe("today");
  });

  it("marks today as 'trained' when a session already exists today", () => {
    const today = "2024-01-08";
    const window = makeWindow(today);

    const dots = classifyWeekDots(window, today, trainedOn(today), ALL_DAYS);
    expect(statusOf(dots, today)).toBe("trained");
  });

  it("marks future days (none in the last-7 window, but window can include today+1=future only if window shifts) as 'future'", () => {
    // In a strict 7-day window ending today there are no future days.
    // We verify that if a future date is included it gets 'future'.
    const today = "2024-01-08";
    const tomorrow = "2024-01-09";
    // Manually build a 7-day window that includes tomorrow (shifted 1 day forward).
    const futureWindow = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() - (5 - i)); // window: today-5 … today … today+1
      return d.toISOString().split("T")[0]!;
    });

    const dots = classifyWeekDots(futureWindow, today, trainedOn(), ALL_DAYS);
    expect(statusOf(dots, tomorrow)).toBe("future");
  });
});

// ── Default training schedule (all days) ─────────────────────────────────────

describe("default training schedule (all 7 days)", () => {
  it("produces no rest dots when every weekday is a training day", () => {
    const today = "2024-01-08";
    const window = makeWindow(today);

    const dots = classifyWeekDots(window, today, trainedOn(), ALL_DAYS);
    const restDots = dots.filter((d) => d.status === "rest");
    expect(restDots).toHaveLength(0);
  });
});

// ── dayIdx contract ───────────────────────────────────────────────────────────

describe("dayIdx correctness", () => {
  it("exposes the correct day-of-week index for each entry", () => {
    // 2024-01-08 is Monday (1), so the window runs Mon Jan 01 … Mon Jan 08.
    const today = "2024-01-08";
    const window = makeWindow(today);

    const dots = classifyWeekDots(window, today, trainedOn(), ALL_DAYS);

    // The last dot is today (Monday = 1).
    expect(dots[6]!.dayIdx).toBe(1);
    // The second-to-last is Sunday (0).
    expect(dots[5]!.dayIdx).toBe(0);
    // The third-to-last is Saturday (6).
    expect(dots[4]!.dayIdx).toBe(6);
  });
});
