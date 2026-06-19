/**
 * Tests for ScoreCard:
 *
 * 1. animate prop forwarding — confirms that ScoreCard passes the `animate`
 *    prop through to the nested ScoreRing unchanged.
 * 2. getScoreBand — confirms the label/colour bucketing logic is correct for
 *    each of the three score bands.
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ─── Capture ScoreRing props ───────────────────────────────────────────────────

let lastScoreRingProps: Record<string, unknown> = {};

jest.mock("@/components/ScoreRing", () => ({
  ScoreRing: (props: Record<string, unknown>) => {
    lastScoreRingProps = props;
    return null;
  },
}));

// ─── Lightweight stubs for ScoreCard's other dependencies ─────────────────────

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    foreground:      "#f5f5f5",
    card:            "#1a1a1a",
    mutedForeground: "#888888",
  }),
}));

// ─── Import under test AFTER mocks ────────────────────────────────────────────

import { ScoreCard, getScoreBand } from "../ScoreCard";

// ─── 1. animate prop forwarding ───────────────────────────────────────────────

describe("ScoreCard — animate prop forwarded to ScoreRing", () => {
  beforeEach(() => {
    lastScoreRingProps = {};
  });

  it("passes animate={true} to ScoreRing when animate=true", () => {
    render(
      <ScoreCard
        label="Technique"
        score={75}
        icon="target"
        desc="Form accuracy"
        animate={true}
      />,
    );
    expect(lastScoreRingProps.animate).toBe(true);
  });

  it("passes animate={false} to ScoreRing when animate=false", () => {
    render(
      <ScoreCard
        label="Power"
        score={80}
        icon="zap"
        desc="Explosiveness"
        animate={false}
      />,
    );
    expect(lastScoreRingProps.animate).toBe(false);
  });

  it("defaults animate to false when the prop is omitted", () => {
    render(
      <ScoreCard label="Balance" score={65} icon="activity" desc="Stability" />,
    );
    expect(lastScoreRingProps.animate).toBe(false);
  });

  it("forwards the correct score value to ScoreRing", () => {
    render(
      <ScoreCard
        label="Mobility"
        score={88}
        icon="maximize-2"
        desc="Range of motion"
        animate={true}
      />,
    );
    expect(lastScoreRingProps.score).toBe(88);
  });
});

// ─── 2. getScoreBand bucketing ────────────────────────────────────────────────

describe("getScoreBand", () => {
  it("returns 'Strong' band for scores >= 80", () => {
    expect(getScoreBand(80).label).toBe("Strong");
    expect(getScoreBand(100).label).toBe("Strong");
  });

  it("returns 'On Track' band for scores 65–79", () => {
    expect(getScoreBand(65).label).toBe("On Track");
    expect(getScoreBand(79).label).toBe("On Track");
  });

  it("returns 'Focus Here' band for scores below 65", () => {
    expect(getScoreBand(64).label).toBe("Focus Here");
    expect(getScoreBand(0).label).toBe("Focus Here");
  });
});
