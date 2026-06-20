import React from "react";
import { render } from "@testing-library/react-native";
import type { AnalysisRecord } from "@/lib/api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// expo-image's Image renders a testable View when present in the tree.
// When thumbnailUrl is absent the component never mounts Image at all
// (it takes the fallback branch), so the testID won't appear.
jest.mock("expo-image", () => ({
  Image: (_props: unknown) => {
    const { View } = require("react-native");
    return <View testID="share-thumbnail-image" />;
  },
}));

// Feather icons get a deterministic testID so tests can distinguish the
// large fallback icon (size 36) from the smaller badge / footer icons.
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, size }: { name: string; size: number }) => {
    const { View } = require("react-native");
    return <View testID={`feather-${name}-${size}`} />;
  },
}));

// react-native-svg is used only for the score ring — stub out both the
// default export (Svg) and the named Circle export.
jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const MockSvg = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  );
  const MockCircle = () => <View />;
  return {
    __esModule: true,
    default: MockSvg,
    Circle: MockCircle,
  };
});

// ─── Fixture data ─────────────────────────────────────────────────────────────

const BASE_ANALYSIS: AnalysisRecord = {
  id:           "a1",
  userId:       "u1",
  title:        "Morning Run",
  sport:        "running",
  status:       "complete",
  overallScore:  72,
  strengths:    [],
  improvements: [],
  uploadedAt:   "2026-06-19T08:00:00.000Z",
};

const WITH_THUMBNAIL: AnalysisRecord = {
  ...BASE_ANALYSIS,
  thumbnailUrl: "https://example.com/thumb.jpg",
};

const WITHOUT_THUMBNAIL: AnalysisRecord = {
  ...BASE_ANALYSIS,
  thumbnailUrl: undefined,
};

// ─── Import after mocks ───────────────────────────────────────────────────────

import { StyleSheet } from "react-native";
import { ShareCard, SHARE_CARD_DARK, SHARE_CARD_LIGHT, SPORT_ICON } from "@/components/analysis/ShareCard";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ShareCard — top tip strip", () => {
  it("renders the tip text when topTip is provided", () => {
    const tip = "Keep your hips level through the stride cycle.";
    const { queryByText } = render(
      <ShareCard analysis={BASE_ANALYSIS} topTip={tip} />,
    );
    expect(queryByText(tip)).not.toBeNull();
  });

  it("does NOT render any tip text when topTip is omitted", () => {
    const tip = "Keep your hips level through the stride cycle.";
    const { queryByText } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    expect(queryByText(tip)).toBeNull();
  });

  it("does NOT render any tip text when topTip is an empty string", () => {
    const { queryByText } = render(
      <ShareCard analysis={BASE_ANALYSIS} topTip="" />,
    );
    // !!'' is false, so the strip must be absent
    expect(queryByText("")).toBeNull();
  });
});

describe("ShareCard — thumbnail vs. fallback", () => {
  it("renders the Image element when thumbnailUrl is provided", () => {
    const { queryByTestId } = render(<ShareCard analysis={WITH_THUMBNAIL} />);
    expect(queryByTestId("share-thumbnail-image")).not.toBeNull();
  });

  it("does NOT render the Image element when thumbnailUrl is absent", () => {
    const { queryByTestId } = render(<ShareCard analysis={WITHOUT_THUMBNAIL} />);
    expect(queryByTestId("share-thumbnail-image")).toBeNull();
  });

  it("shows the sport-icon fallback when thumbnailUrl is absent", () => {
    const { queryByTestId } = render(<ShareCard analysis={WITHOUT_THUMBNAIL} />);
    // The fallback mounts a Feather at size 36 (the badge uses size 10 and
    // the footer uses size 11, so size 36 uniquely identifies the fallback).
    // "running" maps to the "wind" Feather icon via the SPORT_ICON lookup.
    expect(queryByTestId("feather-wind-36")).not.toBeNull();
  });

  it("does NOT show the fallback sport icon when a thumbnail is present", () => {
    const { queryByTestId } = render(<ShareCard analysis={WITH_THUMBNAIL} />);
    expect(queryByTestId("feather-wind-36")).toBeNull();
  });
});

// ─── Sport-icon fallback — parameterised over every supported sport ────────────
//
// Derived directly from the exported SPORT_ICON map so that adding a new sport
// to ShareCard.tsx automatically generates a new test case here with no manual
// update required.

const SPORT_ICON_CASES: [string, string][] = Object.entries(SPORT_ICON) as [string, string][];

describe("ShareCard — sport-icon fallback (all supported sports)", () => {
  it.each(SPORT_ICON_CASES)(
    'sport "%s" renders Feather icon "%s" at size 36 when no thumbnail is supplied',
    (sport, expectedIcon) => {
      const analysis: AnalysisRecord = {
        ...BASE_ANALYSIS,
        sport,
        thumbnailUrl: undefined,
      };
      const { queryByTestId } = render(<ShareCard analysis={analysis} />);
      expect(queryByTestId(`feather-${expectedIcon}-36`)).not.toBeNull();
    },
  );

  it('unknown sport renders the "activity" fallback icon at size 36', () => {
    const slug = "underwater-polo";
    // Guard: confirm this slug is genuinely absent from the map so that if
    // someone later adds it, this test will fail loudly instead of silently
    // rendering the wrong icon.
    expect(SPORT_ICON[slug]).toBeUndefined();

    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      sport: slug,
      thumbnailUrl: undefined,
    };
    const { queryByTestId } = render(<ShareCard analysis={analysis} />);
    expect(queryByTestId("feather-activity-36")).not.toBeNull();
  });

  it("sport lookup is case-insensitive (RUNNING → wind icon)", () => {
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      sport: "RUNNING",
      thumbnailUrl: undefined,
    };
    const { queryByTestId } = render(<ShareCard analysis={analysis} />);
    expect(queryByTestId("feather-wind-36")).not.toBeNull();
  });
});

// ─── Color scheme palette ──────────────────────────────────────────────────────
// These tests guard against a refactor accidentally wiring both schemes to the
// same palette.  Each test locates the card root by testID, flattens its style,
// and asserts the scheme-specific background color.

type FlatStyle = { backgroundColor?: string };

describe("ShareCard — color scheme palette", () => {
  it('applies the dark-palette background when colorScheme="dark"', () => {
    const { getByTestId } = render(
      <ShareCard analysis={BASE_ANALYSIS} colorScheme="dark" />,
    );
    const card = getByTestId("share-card-dark");
    const flat = StyleSheet.flatten(card.props.style) as FlatStyle;
    expect(flat.backgroundColor).toBe(SHARE_CARD_DARK.cardBg);
  });

  it("applies the dark-palette background when colorScheme is omitted (default is dark)", () => {
    const { getByTestId } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    const card = getByTestId("share-card-dark");
    const flat = StyleSheet.flatten(card.props.style) as FlatStyle;
    expect(flat.backgroundColor).toBe(SHARE_CARD_DARK.cardBg);
  });

  it('applies the light-palette background when colorScheme="light"', () => {
    const { getByTestId } = render(
      <ShareCard analysis={BASE_ANALYSIS} colorScheme="light" />,
    );
    const card = getByTestId("share-card-light");
    const flat = StyleSheet.flatten(card.props.style) as FlatStyle;
    expect(flat.backgroundColor).toBe(SHARE_CARD_LIGHT.cardBg);
  });

  it("dark and light cardBg values are distinct", () => {
    expect(SHARE_CARD_DARK.cardBg).not.toBe(SHARE_CARD_LIGHT.cardBg);
  });

  it("dark and light cardBorder values are distinct", () => {
    expect(SHARE_CARD_DARK.cardBorder).not.toBe(SHARE_CARD_LIGHT.cardBorder);
  });

  it("dark and light cardSurface values are distinct", () => {
    expect(SHARE_CARD_DARK.cardSurface).not.toBe(SHARE_CARD_LIGHT.cardSurface);
  });
});
