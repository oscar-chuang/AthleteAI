/**
 * Integration test — calls Claude directly to verify the prompt reliably
 * produces drillFeelCue on every tip drill.
 *
 * SKIPPED automatically unless RUN_LIVE_API_TESTS=1 is set.
 * This prevents the test from failing when ANTHROPIC_API_KEY is present but
 * has insufficient credits (common in development environments).
 *
 * To run: RUN_LIVE_API_TESTS=1 pnpm --filter @workspace/api-server test
 */
import { describe, it, expect } from "vitest";
import { analyzeAthletePerformance } from "./anthropic";

const RUN_LIVE = !!process.env.RUN_LIVE_API_TESTS;

describe.skipIf(!RUN_LIVE)(
  "analyzeAthletePerformance — live Claude contract (requires RUN_LIVE_API_TESTS=1)",
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
