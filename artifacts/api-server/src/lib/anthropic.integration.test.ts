/**
 * Integration test — calls Claude directly to verify the prompt reliably
 * produces drillFeelCue on every tip drill.
 *
 * SKIPPED automatically when ANTHROPIC_API_KEY is absent (CI-safe).
 * Run locally with a real key to catch prompt regressions.
 */
import { describe, it, expect } from "vitest";
import { analyzeAthletePerformance } from "./anthropic";

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)(
  "analyzeAthletePerformance — live Claude contract (requires ANTHROPIC_API_KEY)",
  () => {
    it(
      "returns a non-empty drillFeelCue on every tip drill (weightlifting fixture with high-risk knee angles)",
      async () => {
        const result = await analyzeAthletePerformance(
          "weightlifting",
          "Back Squat – integration fixture",
          null,
          null,
          { leftKnee: 138, rightKnee: 135 },
          { leftKnee: 2, rightKnee: 2 },
          null
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result.tips)).toBe(true);

        // The fixture has two HIGH RISK joints — Claude must produce at least one tip.
        expect(result.tips.length).toBeGreaterThan(0);

        // Every tip must include a drill (the prompt mandates "ONE drill per tip").
        // Every drill must include a non-empty drillFeelCue.
        for (const tip of result.tips) {
          expect(
            tip.drill,
            `tip "${tip.title}" (${tip.tipType}) is missing drill entirely`
          ).toBeDefined();

          expect(
            typeof tip.drill!.drillFeelCue,
            `tip "${tip.title}" drillFeelCue must be a string`
          ).toBe("string");

          expect(
            tip.drill!.drillFeelCue!.trim().length,
            `tip "${tip.title}" drillFeelCue is empty or whitespace-only`
          ).toBeGreaterThan(10);
        }
      },
      60_000
    );
  }
);
