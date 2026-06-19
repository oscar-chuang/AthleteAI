/**
 * Jest tests for ShareCard.
 *
 * 1. Smoke tests — confirm the component renders without crashing
 *    (prerequisite for react-native-view-shot's captureRef to produce a
 *    non-blank PNG).
 * 2. Capture-options contract — verify SHARE_CARD_CAPTURE_OPTIONS and
 *    HIDDEN_SHARE_CARD_STYLE satisfy Android-safe invariants.
 * 3. Snapshot tests — lock the rendered tree for both colour schemes so
 *    any future visual change requires an explicit snapshot update.
 */

import React from "react";
import { render } from "@testing-library/react-native";
import renderer from "react-test-renderer";

// ─── RN / Expo mocks ──────────────────────────────────────────────────────────

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const MockSvg = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  );
  const MockCircle = () => <View />;
  return { __esModule: true, default: MockSvg, Circle: MockCircle };
});

jest.mock("expo-image", () => ({
  Image: (_props: unknown) => {
    const { View } = require("react-native");
    return <View testID="share-thumbnail-image" />;
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, size }: { name: string; size: number }) => {
    const { View } = require("react-native");
    return <View testID={`feather-${name}-${size}`} />;
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

const TOP_TIP = "Keep your cadence above 170 spm and land mid-foot.";

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { ShareCard } from "../ShareCard";
import {
  SHARE_CARD_CAPTURE_OPTIONS,
  HIDDEN_SHARE_CARD_STYLE,
} from "@/utils/shareCardCapture";

// ─── 1. Smoke tests ───────────────────────────────────────────────────────────

describe("ShareCard — render smoke test", () => {
  it("renders without throwing (prerequisite for captureRef to produce a non-blank PNG)", () => {
    expect(() => {
      render(<ShareCard analysis={ANALYSIS} />);
    }).not.toThrow();
  });

  it("renders with a top coaching tip without throwing", () => {
    expect(() => {
      render(<ShareCard analysis={ANALYSIS} topTip={TOP_TIP} />);
    }).not.toThrow();
  });

  it("renders with light colour scheme without throwing", () => {
    expect(() => {
      render(<ShareCard analysis={ANALYSIS} colorScheme="light" />);
    }).not.toThrow();
  });
});

// ─── 2. Capture-options contract ──────────────────────────────────────────────

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

// ─── 3. Snapshot tests ────────────────────────────────────────────────────────

describe("ShareCard — snapshots", () => {
  it("matches snapshot: dark scheme, with tip, no thumbnail", () => {
    const tree = renderer
      .create(
        <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} colorScheme="dark" />,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("matches snapshot: light scheme, with tip, no thumbnail", () => {
    const tree = renderer
      .create(
        <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} colorScheme="light" />,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("matches snapshot: dark scheme, no tip, no thumbnail", () => {
    const tree = renderer
      .create(<ShareCard analysis={ANALYSIS} colorScheme="dark" />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });

  it("matches snapshot: dark scheme, with thumbnail", () => {
    const analysisWithThumb: AnalysisRecord = {
      ...ANALYSIS,
      thumbnailUrl: "https://example.com/thumb.jpg",
    };
    const tree = renderer
      .create(
        <ShareCard
          analysis={analysisWithThumb}
          topTip={TOP_TIP}
          colorScheme="dark"
        />,
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
