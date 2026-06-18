import { describe, it, expect } from "vitest";
import {
  type Capture,
  containRect,
  projectLandmark,
  pickHeroCapture,
  captureForJoints,
  riskMatchesJoints,
} from "../utils/skeleton";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cap(over: Partial<Capture> = {}): Capture {
  return {
    id: "c",
    kind: "joint",
    time: 0,
    aspect: 1,
    frame: "data:,",
    lm: [],
    jr: {},
    joints: [],
    maxLvl: 0,
    ...over,
  };
}

// ── containRect ──────────────────────────────────────────────────────────────

describe("containRect", () => {
  it("pillarboxes a tall image inside a wide box (centres horizontally)", () => {
    // box 400×200 (aspect 2), image aspect 1 → fit to height, narrower width.
    const r = containRect(400, 200, 1);
    expect(r).toEqual({ left: 100, top: 0, width: 200, height: 200 });
  });

  it("letterboxes a wide image inside a tall box (centres vertically)", () => {
    // box 200×400 (aspect 0.5), image aspect 1 → fit to width, shorter height.
    const r = containRect(200, 400, 1);
    expect(r).toEqual({ left: 0, top: 100, width: 200, height: 200 });
  });

  it("fills the box exactly when aspect ratios match", () => {
    expect(containRect(300, 300, 1)).toEqual({ left: 0, top: 0, width: 300, height: 300 });
  });

  it("falls back to the raw box on a non-positive dimension", () => {
    expect(containRect(0, 100, 1)).toEqual({ left: 0, top: 0, width: 0, height: 100 });
  });

  it("falls back to the raw box on a non-positive aspect", () => {
    expect(containRect(100, 100, 0)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

// ── projectLandmark ──────────────────────────────────────────────────────────

describe("projectLandmark", () => {
  it("maps a normalised landmark through a letterboxed rect", () => {
    const rect = { left: 100, top: 0, width: 200, height: 200 };
    expect(projectLandmark({ x: 0.5, y: 0.5 }, rect)).toEqual({ x: 200, y: 100 });
    expect(projectLandmark({ x: 0, y: 1 }, rect)).toEqual({ x: 100, y: 200 });
  });
});

// ── pickHeroCapture ──────────────────────────────────────────────────────────

describe("pickHeroCapture", () => {
  it("returns null for an empty list", () => {
    expect(pickHeroCapture([])).toBeNull();
  });

  it("prefers the dedicated worst-frame even when another has a higher maxLvl", () => {
    const worst = cap({ id: "worst", kind: "worst", maxLvl: 1 });
    const hotter = cap({ id: "hot", kind: "joint", maxLvl: 2 });
    expect(pickHeroCapture([hotter, worst])).toBe(worst);
  });

  it("falls back to the highest-risk capture when there is no worst frame", () => {
    const low = cap({ id: "low", maxLvl: 1 });
    const high = cap({ id: "high", maxLvl: 2 });
    expect(pickHeroCapture([low, high])).toBe(high);
  });

  it("falls back to the clear frame when every capture is risk-free", () => {
    const a = cap({ id: "a", kind: "joint", maxLvl: 0 });
    const clear = cap({ id: "clear", kind: "clear", maxLvl: 0 });
    expect(pickHeroCapture([a, clear])).toBe(clear);
  });

  it("falls back to the first capture when there is no worst/clear and no risk", () => {
    const a = cap({ id: "a", kind: "joint", maxLvl: 0 });
    const b = cap({ id: "b", kind: "joint", maxLvl: 0 });
    expect(pickHeroCapture([a, b])).toBe(a);
  });
});

// ── captureForJoints ─────────────────────────────────────────────────────────

describe("captureForJoints", () => {
  it("returns null for an empty list", () => {
    expect(captureForJoints([], ["leftKnee"])).toBeNull();
  });

  it("returns the hero capture when no joints are requested", () => {
    const worst = cap({ id: "worst", kind: "worst", maxLvl: 1 });
    const other = cap({ id: "other", maxLvl: 2 });
    expect(captureForJoints([other, worst], [])).toBe(worst);
  });

  it("picks the capture with the highest risk reading for the joint", () => {
    const a = cap({ id: "a", jr: { leftKnee: { deg: 90, lvl: 1 } }, joints: ["leftKnee"], maxLvl: 1 });
    const b = cap({ id: "b", jr: { leftKnee: { deg: 80, lvl: 2 } }, joints: ["leftKnee"], maxLvl: 2 });
    expect(captureForJoints([a, b], ["leftKnee"])).toBe(b);
  });

  it("matches a capture that lists the joint as flagged even without a numeric reading", () => {
    const flaggedNoReading = cap({ id: "d", jr: {}, joints: ["leftKnee"], maxLvl: 1 });
    const unrelated = cap({ id: "e", jr: {}, joints: [], maxLvl: 0 });
    expect(captureForJoints([unrelated, flaggedNoReading], ["leftKnee"])).toBe(flaggedNoReading);
  });

  it("falls back to the hero capture when no capture mentions the joint", () => {
    const c = cap({ id: "c", jr: { rightHip: { deg: 40, lvl: 2 } }, joints: ["rightHip"], maxLvl: 2 });
    expect(captureForJoints([c], ["leftKnee"])).toBe(c);
  });
});

// ── riskMatchesJoints ────────────────────────────────────────────────────────

describe("riskMatchesJoints", () => {
  it("matches a sided risk string to the same-sided joint", () => {
    expect(riskMatchesJoints("Left Knee", ["leftKnee"])).toBe(true);
  });

  it("does not match a sided risk string to the opposite side", () => {
    expect(riskMatchesJoints("right knee", ["leftKnee"])).toBe(false);
  });

  it("matches a side-less risk string to either side", () => {
    expect(riskMatchesJoints("knee", ["leftKnee"])).toBe(true);
    expect(riskMatchesJoints("knee", ["rightKnee"])).toBe(true);
  });

  it("understands lead/rear/trail as side synonyms", () => {
    expect(riskMatchesJoints("lead elbow", ["leftElbow"])).toBe(true);
    expect(riskMatchesJoints("rear hip", ["rightHip"])).toBe(true);
    expect(riskMatchesJoints("trail knee", ["leftKnee"])).toBe(false);
  });

  it("returns false when the body part is unknown or inputs are empty", () => {
    expect(riskMatchesJoints("shoulder", ["leftKnee"])).toBe(false);
    expect(riskMatchesJoints("", ["leftKnee"])).toBe(false);
    expect(riskMatchesJoints("knee", [])).toBe(false);
  });
});
