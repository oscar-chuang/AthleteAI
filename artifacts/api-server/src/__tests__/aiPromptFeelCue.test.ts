/**
 * Unit tests verifying the AI analysis prompt template always requests
 * drillFeelCue for every drill it generates.
 *
 * drillFeelCue is the proprioceptive "feel" instruction that tells the athlete
 * what internal body sensation to notice while executing a drill correctly.
 * Without it in the prompt the AI may omit the field entirely, leaving coaching
 * context sparse and the chat system-prompt less useful.
 *
 * Key invariants:
 *   1. SYSTEM_PROMPT (the JSON schema given to Claude) declares "drillFeelCue"
 *      so the AI knows the field exists and what it should contain.
 *   2. The user prompt built per analysis explicitly instructs Claude to include
 *      a feel cue for every drill, both with and without joint-angle data.
 */

import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildAnalysisUserPrompt } from "../lib/anthropic";

describe("AI analysis prompt — drillFeelCue requirement", () => {
  it("SYSTEM_PROMPT JSON schema declares the drillFeelCue field for drills", () => {
    expect(SYSTEM_PROMPT).toContain("drillFeelCue");
  });

  it("SYSTEM_PROMPT describes drillFeelCue as a proprioceptive body-sensation cue", () => {
    expect(SYSTEM_PROMPT).toMatch(/drillFeelCue.*body sensation/si);
  });

  it("user prompt instructs Claude to include a feel cue when joint-angle data is present", () => {
    const prompt = buildAnalysisUserPrompt({
      sport: "running",
      title: "Test Session",
      jointAngles: { leftKnee: 90, rightKnee: 88 },
      jointRisks: { leftKnee: 2, rightKnee: 1 },
    });

    expect(prompt).toContain("drillFeelCue");
    expect(prompt).toContain("feel cue");
  });

  it("user prompt instructs Claude to include a feel cue even without joint-angle data", () => {
    const prompt = buildAnalysisUserPrompt({
      sport: "weightlifting",
      title: "No-data Session",
    });

    expect(prompt).toContain("drillFeelCue");
    expect(prompt).toContain("feel cue");
  });

  it("feel cue instruction is not gated behind the hasData branch (always present)", () => {
    const withData = buildAnalysisUserPrompt({
      sport: "swimming",
      title: "With Data",
      jointAngles: { leftKnee: 95 },
    });
    const withoutData = buildAnalysisUserPrompt({
      sport: "swimming",
      title: "Without Data",
    });

    const feelLine = "drillFeelCue — the internal body sensation when executed correctly";
    expect(withData).toContain(feelLine);
    expect(withoutData).toContain(feelLine);
  });
});
