import { describe, it, expect } from "vitest";
import { buildNextStepCue } from "../buildNextStepCue";
import type { JointTrendsResponse } from "../../lib/api";
import type { JointKey } from "../analysisUtils";

const drill = { id: "d1", name: "Goblet Squat", sets: "3", reps: "10", rest: "60s", cue: "Keep chest up" };

function makeTrends(
  joint: JointKey,
  points: Array<{ date: string; risk: number; angle: number }>,
): JointTrendsResponse {
  return {
    joints: {
      [joint]: points.map((p) => ({
        analysisId: `a-${p.date}`,
        date: p.date,
        sport: "running",
        angle: p.angle,
        risk: p.risk,
      })),
    },
    improvements: [],
  };
}

describe("buildNextStepCue", () => {
  describe("path 1 — joint improved fully out of the risky range (newest.risk === 0)", () => {
    it("returns a load-progression cue for injury kind", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 140 },
        { date: "2026-02-01", risk: 1, angle: 150 },
        { date: "2026-03-01", risk: 0, angle: 155 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], trends);
      expect(result).toContain("L Knee");
      expect(result).toContain("out of the risky range");
      expect(result).toContain("loaded variation");
    });

    it("returns a load-progression cue for performance kind", () => {
      const trends = makeTrends("rightHip", [
        { date: "2026-01-01", risk: 2, angle: 80 },
        { date: "2026-03-01", risk: 0, angle: 90 },
      ]);
      const result = buildNextStepCue(drill, "performance", ["rightHip"], trends);
      expect(result).toContain("R Hip");
      expect(result).toContain("safe range");
      expect(result).toContain("time to advance");
    });

    it("includes the angle delta when it is >= 3 degrees", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 130 },
        { date: "2026-03-01", risk: 0, angle: 140 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], trends);
      expect(result).toContain("10°");
    });

    it("omits the angle delta when the change is less than 3 degrees", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 130 },
        { date: "2026-03-01", risk: 0, angle: 131 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], trends);
      expect(result).not.toMatch(/\d+°/);
    });
  });

  describe("path 2 — joint trending better but residual risk remains (newest.risk > 0)", () => {
    it("returns a keep-going cue for injury kind", () => {
      const trends = makeTrends("rightKnee", [
        { date: "2026-01-01", risk: 2, angle: 145 },
        { date: "2026-03-01", risk: 1, angle: 152 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["rightKnee"], trends);
      expect(result).toContain("R Knee");
      expect(result).toContain("trending better");
      expect(result).toContain("corrective work");
    });

    it("returns a keep-going cue for performance kind", () => {
      const trends = makeTrends("leftElbow", [
        { date: "2026-01-01", risk: 2, angle: 45 },
        { date: "2026-03-01", risk: 1, angle: 55 },
      ]);
      const result = buildNextStepCue(drill, "performance", ["leftElbow"], trends);
      expect(result).toContain("L Elbow");
      expect(result).toContain("solid progress");
      expect(result).toContain("45 s");
    });

    it("picks the joint with the largest risk drop when multiple joints are supplied", () => {
      const trends: JointTrendsResponse = {
        joints: {
          leftKnee: [
            { analysisId: "a1", date: "2026-01-01", sport: "running", risk: 2, angle: 140 },
            { analysisId: "a2", date: "2026-03-01", sport: "running", risk: 1, angle: 148 },
          ],
          rightHip: [
            { analysisId: "a3", date: "2026-01-01", sport: "running", risk: 2, angle: 80 },
            { analysisId: "a4", date: "2026-03-01", sport: "running", risk: 0, angle: 90 },
          ],
        },
        improvements: [],
      };
      const result = buildNextStepCue(drill, "injury", ["leftKnee", "rightHip"], trends);
      expect(result).toContain("R Hip");
      expect(result).not.toContain("L Knee");
    });
  });

  describe("path 3 — no trend data / no improvement → generic fallback", () => {
    it("returns a generic cue when jointTrendsData is null", () => {
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], null);
      expect(result).toContain("4 sets");
    });

    it("returns a generic cue when jointTrendsData is undefined", () => {
      const result = buildNextStepCue(drill, "performance", ["leftKnee"], undefined);
      expect(result).toContain("4 sets");
    });

    it("returns a generic cue when no joints list is supplied", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 140 },
        { date: "2026-03-01", risk: 0, angle: 150 },
      ]);
      const result = buildNextStepCue(drill, "injury", undefined, trends);
      expect(result).toContain("4 sets");
    });

    it("returns a generic cue when the joint has only one data point (no trend)", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 140 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], trends);
      expect(result).toContain("4 sets");
    });

    it("returns a generic cue when the joint data shows no improvement (risk stayed the same)", () => {
      const trends = makeTrends("leftKnee", [
        { date: "2026-01-01", risk: 2, angle: 140 },
        { date: "2026-03-01", risk: 2, angle: 142 },
      ]);
      const result = buildNextStepCue(drill, "injury", ["leftKnee"], trends);
      expect(result).toContain("4 sets");
    });

    it("returns a string-drill fallback when drill is a plain string and no trends", () => {
      const result = buildNextStepCue("Some drill name", "performance", undefined, null);
      expect(result).toContain("one more round");
    });

    it("adjusts the set count from the drill object in the fallback", () => {
      const d = { ...drill, sets: "5" };
      const result = buildNextStepCue(d, "performance", [], null);
      expect(result).toContain("6 sets");
    });
  });
});
