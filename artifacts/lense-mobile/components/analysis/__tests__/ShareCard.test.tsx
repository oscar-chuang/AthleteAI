/**
 * Jest smoke test for ShareCard.
 *
 * Confirms the component renders without crashing — a prerequisite for
 * react-native-view-shot's captureRef to produce a non-blank PNG.
 * If ShareCard throws during render, captureRef would capture nothing.
 *
 * Also verifies that the capture options object used in production
 * (SHARE_CARD_CAPTURE_OPTIONS) and the hidden-view style
 * (HIDDEN_SHARE_CARD_STYLE) satisfy the Android-safe invariants when
 * imported from their real source.
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ─── RN / Expo mocks ──────────────────────────────────────────────────────────

jest.mock("react-native-svg", () => {
  const React = require("react");
  const Svg = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("Svg", null, children);
  const Circle = () => null;
  return { __esModule: true, default: Svg, Svg, Circle };
});

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Image: (props: any) => React.createElement(View, props) };
});

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

import type { AnalysisRecord } from "@/lib/api";

const ANALYSIS: AnalysisRecord = {
  id:               "a1",
  userId:           "u1",
  title:            "Morning Run",
  sport:            "running",
  status:           "complete",
  uploadedAt:       "2026-06-19T08:00:00Z",
  strengths:        ["Good cadence", "Strong push-off"],
  improvements:     ["Land mid-foot", "Relax shoulders"],
  overallScore:     78,
  techniqueScore:   80,
  powerScore:       75,
  balanceScore:     72,
  consistencyScore: 81,
  mobilityScore:    70,
  speedScore:       84,
  biomechanicsApplied: true,
};

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import { ShareCard } from "../ShareCard";
import {
  SHARE_CARD_CAPTURE_OPTIONS,
  HIDDEN_SHARE_CARD_STYLE,
} from "@/utils/shareCardCapture";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ShareCard — render smoke test", () => {
  it("renders without throwing (prerequisite for captureRef to produce a non-blank PNG)", () => {
    expect(() => {
      render(<ShareCard analysis={ANALYSIS} />);
    }).not.toThrow();
  });

  it("renders with a top coaching tip without throwing", () => {
    expect(() => {
      render(
        <ShareCard
          analysis={ANALYSIS}
          topTip="Keep your cadence above 170 spm and land mid-foot."
        />
      );
    }).not.toThrow();
  });

  it("renders with light colour scheme without throwing", () => {
    expect(() => {
      render(<ShareCard analysis={ANALYSIS} colorScheme="light" />);
    }).not.toThrow();
  });
});

// ─── Capture options contract (imported from real source) ─────────────────────

describe("SHARE_CARD_CAPTURE_OPTIONS — source-linked contract", () => {
  it("format is png", () => {
    expect(SHARE_CARD_CAPTURE_OPTIONS.format).toBe("png");
  });

  it("quality is 1 (lossless)", () => {
    expect(SHARE_CARD_CAPTURE_OPTIONS.quality).toBe(1);
  });

  it("result is tmpfile", () => {
    expect(SHARE_CARD_CAPTURE_OPTIONS.result).toBe("tmpfile");
  });
});

// ─── Hidden-view style contract (imported from real source) ───────────────────

describe("HIDDEN_SHARE_CARD_STYLE — Android-safe invariants", () => {
  it("top >= 0 (within window bounds)", () => {
    expect(HIDDEN_SHARE_CARD_STYLE.top).toBeGreaterThanOrEqual(0);
  });

  it("left >= 0 (within window bounds)", () => {
    expect(HIDDEN_SHARE_CARD_STYLE.left).toBeGreaterThanOrEqual(0);
  });

  it("opacity is 0 (hidden, not off-screen)", () => {
    expect(HIDDEN_SHARE_CARD_STYLE.opacity).toBe(0);
  });

  it("top is not -9999 (off-screen trick that blanks Android captures)", () => {
    expect(HIDDEN_SHARE_CARD_STYLE.top).not.toBe(-9999);
  });
});
