import { describe, it, expect } from "vitest";
import { buildSnapshot, computeIsDirty, type ProfileSnapshot } from "../profileDirty";

const ALL_SNAPSHOT_KEYS: Array<keyof ProfileSnapshot> = [
  "name",
  "sport",
  "level",
  "goals",
  "injuries",
];

const base = {
  name: "Alex Smith",
  sport: "Running",
  level: "Intermediate",
  goals: ["Improve technique"],
  injuries: ["No current injuries"],
};

describe("buildSnapshot", () => {
  it("includes every key declared in ProfileSnapshot", () => {
    const parsed = JSON.parse(buildSnapshot(base));
    for (const key of ALL_SNAPSHOT_KEYS) {
      expect(parsed).toHaveProperty(key);
    }
  });

  it("returns a stable JSON string", () => {
    const s = buildSnapshot(base);
    expect(typeof s).toBe("string");
    expect(JSON.parse(s)).toEqual(base);
  });

  it("produces identical strings for identical inputs", () => {
    expect(buildSnapshot(base)).toBe(buildSnapshot({ ...base }));
  });

  it("produces different strings when a field differs", () => {
    expect(buildSnapshot(base)).not.toBe(buildSnapshot({ ...base, name: "Jordan Lee" }));
  });
});

describe("computeIsDirty", () => {
  it("returns false when current equals saved", () => {
    const snap = buildSnapshot(base);
    expect(computeIsDirty(snap, snap)).toBe(false);
  });

  it("returns true when name changes", () => {
    const saved = buildSnapshot(base);
    const current = buildSnapshot({ ...base, name: "Jordan Lee" });
    expect(computeIsDirty(current, saved)).toBe(true);
  });

  it("returns true when sport changes", () => {
    const saved = buildSnapshot(base);
    const current = buildSnapshot({ ...base, sport: "Soccer" });
    expect(computeIsDirty(current, saved)).toBe(true);
  });

  it("returns true when level changes", () => {
    const saved = buildSnapshot(base);
    const current = buildSnapshot({ ...base, level: "Elite" });
    expect(computeIsDirty(current, saved)).toBe(true);
  });

  it("returns true when a goal is added", () => {
    const saved = buildSnapshot(base);
    const current = buildSnapshot({ ...base, goals: [...base.goals, "Competition prep"] });
    expect(computeIsDirty(current, saved)).toBe(true);
  });

  it("returns true when an injury concern changes", () => {
    const saved = buildSnapshot(base);
    const current = buildSnapshot({ ...base, injuries: ["Knee"] });
    expect(computeIsDirty(current, saved)).toBe(true);
  });

  it("returns false after reverting all changes back to saved values", () => {
    const saved = buildSnapshot(base);
    const modified = buildSnapshot({ ...base, name: "Temp Name" });
    expect(computeIsDirty(modified, saved)).toBe(true);

    const reverted = buildSnapshot({ ...base });
    expect(computeIsDirty(reverted, saved)).toBe(false);
  });
});
