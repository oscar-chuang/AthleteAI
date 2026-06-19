import { describe, it, expect } from "vitest";
import { buildGoalShareMessage } from "../utils/shareUtils";

const PREFIX = "I hit my weekly training goal on AthleteAI! 🏆";

// ── Session count pluralisation ───────────────────────────────────────────────

describe("buildGoalShareMessage — session count", () => {
  it("uses 'session' (singular) for exactly 1 session", () => {
    const msg = buildGoalShareMessage({ sessionCount: 1 });
    expect(msg).toContain("1 session this week");
    expect(msg).not.toContain("1 sessions");
  });

  it("uses 'sessions' (plural) for 2 sessions", () => {
    const msg = buildGoalShareMessage({ sessionCount: 2 });
    expect(msg).toContain("2 sessions this week");
  });

  it("uses 'sessions' (plural) for 5 sessions", () => {
    const msg = buildGoalShareMessage({ sessionCount: 5 });
    expect(msg).toContain("5 sessions this week");
  });

  it("uses 'sessions' (plural) for 0 sessions", () => {
    const msg = buildGoalShareMessage({ sessionCount: 0 });
    expect(msg).toContain("0 sessions this week");
  });
});

// ── Sport suffix ──────────────────────────────────────────────────────────────

describe("buildGoalShareMessage — sport", () => {
  it("appends the sport in parentheses when sport is provided", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, sport: "running" });
    expect(msg).toContain("(running)");
  });

  it("omits the sport suffix when sport is undefined", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3 });
    expect(msg).not.toMatch(/\(.+\)/);
  });

  it("omits the sport suffix when sport is null", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, sport: null });
    expect(msg).not.toMatch(/\(.+\)/);
  });

  it("omits the sport suffix when sport is an empty string", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, sport: "" });
    expect(msg).not.toMatch(/\(.+\)/);
  });

  it("places the sport suffix before the period", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, sport: "cycling" });
    expect(msg).toMatch(/\(cycling\)\./);
  });
});

// ── Streak suffix ─────────────────────────────────────────────────────────────

describe("buildGoalShareMessage — streak", () => {
  it("appends a streak suffix when streakDays > 1", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, streakDays: 7 });
    expect(msg).toContain("7-day streak and counting!");
  });

  it("omits the streak suffix when streakDays === 1", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, streakDays: 1 });
    expect(msg).not.toContain("streak");
  });

  it("omits the streak suffix when streakDays === 0", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, streakDays: 0 });
    expect(msg).not.toContain("streak");
  });

  it("omits the streak suffix when streakDays is not provided", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3 });
    expect(msg).not.toContain("streak");
  });

  it("uses the exact day count in the streak suffix", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, streakDays: 14 });
    expect(msg).toContain("14-day streak and counting!");
  });
});

// ── Combined cases ────────────────────────────────────────────────────────────

describe("buildGoalShareMessage — combined", () => {
  it("formats correctly for 1 session, no sport, no streak", () => {
    const msg = buildGoalShareMessage({ sessionCount: 1 });
    expect(msg).toBe(`${PREFIX} 1 session this week.`);
  });

  it("formats correctly for multiple sessions, no sport, no streak", () => {
    const msg = buildGoalShareMessage({ sessionCount: 4 });
    expect(msg).toBe(`${PREFIX} 4 sessions this week.`);
  });

  it("formats correctly for 1 session with sport, no streak", () => {
    const msg = buildGoalShareMessage({ sessionCount: 1, sport: "swimming" });
    expect(msg).toBe(`${PREFIX} 1 session this week (swimming).`);
  });

  it("formats correctly for multiple sessions with sport, no streak", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, sport: "tennis" });
    expect(msg).toBe(`${PREFIX} 3 sessions this week (tennis).`);
  });

  it("formats correctly for multiple sessions, no sport, with streak > 1", () => {
    const msg = buildGoalShareMessage({ sessionCount: 3, streakDays: 5 });
    expect(msg).toBe(`${PREFIX} 3 sessions this week. 5-day streak and counting!`);
  });

  it("formats correctly for 1 session, no sport, streak === 1 (no suffix)", () => {
    const msg = buildGoalShareMessage({ sessionCount: 1, streakDays: 1 });
    expect(msg).toBe(`${PREFIX} 1 session this week.`);
  });

  it("formats correctly for multiple sessions with sport and streak > 1", () => {
    const msg = buildGoalShareMessage({ sessionCount: 5, sport: "football", streakDays: 10 });
    expect(msg).toBe(`${PREFIX} 5 sessions this week (football). 10-day streak and counting!`);
  });

  it("always starts with the standard prefix", () => {
    const msg = buildGoalShareMessage({ sessionCount: 2, sport: "yoga", streakDays: 3 });
    expect(msg.startsWith(PREFIX)).toBe(true);
  });
});
