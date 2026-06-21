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

// ─── 0. Sport label is always title-cased ────────────────────────────────────

describe("ShareCard — sport label title case", () => {
  it("renders a lowercase raw sport value in title case in the sport badge", () => {
    const { getAllByText } = render(<ShareCard analysis={ANALYSIS} />);
    expect(getAllByText("Running").length).toBeGreaterThan(0);
  });

  it("never renders the raw lowercase sport value", () => {
    const { queryByText } = render(<ShareCard analysis={ANALYSIS} />);
    expect(queryByText("running")).toBeNull();
  });

  it("renders 'Swimming' when sport is 'swimming'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "swimming" }} />,
    );
    expect(getAllByText("Swimming").length).toBeGreaterThan(0);
  });

  it("does not render the raw 'swimming' value", () => {
    const { queryByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "swimming" }} />,
    );
    expect(queryByText("swimming")).toBeNull();
  });

  it("renders a multi-word sport in title case", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "weight lifting" }} />,
    );
    expect(getAllByText("Weight Lifting").length).toBeGreaterThan(0);
  });

  it("does not render the raw multi-word sport value", () => {
    const { queryByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "weight lifting" }} />,
    );
    expect(queryByText("weight lifting")).toBeNull();
  });

  it("renders 'Basketball' when sport is 'basketball'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "basketball" }} />,
    );
    expect(getAllByText("Basketball").length).toBeGreaterThan(0);
  });

  it("renders 'Yoga' when sport is 'yoga'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "yoga" }} />,
    );
    expect(getAllByText("Yoga").length).toBeGreaterThan(0);
  });

  it("renders a title-cased sport label in the thumbnail fallback when there is no thumbnailUrl", () => {
    const { UNSAFE_getAllByType } = render(
      <ShareCard analysis={{ ...ANALYSIS, sport: "cycling" }} />,
    );
    const { Text } = require("react-native");
    const textNodes = UNSAFE_getAllByType(Text);
    const cyclingNodes = textNodes.filter(
      (n: { props: { children?: unknown } }) => n.props.children === "Cycling",
    );
    expect(cyclingNodes.length).toBeGreaterThan(0);
  });
});

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

// ─── 2. topTip visibility ─────────────────────────────────────────────────────

describe("ShareCard — topTip conditional rendering", () => {
  it("shows the tip text when topTip is provided", () => {
    const { getByText } = render(<ShareCard analysis={ANALYSIS} topTip={TOP_TIP} />);
    expect(getByText(TOP_TIP)).toBeTruthy();
  });

  it("hides the message-circle icon row when topTip is omitted", () => {
    const { queryByTestId } = render(<ShareCard analysis={ANALYSIS} />);
    // The Feather mock renders testID="feather-<name>-<size>"; size=11 matches tipStrip
    expect(queryByTestId("feather-message-circle-11")).toBeNull();
  });
});

// ─── 3. Tip-text truncation ───────────────────────────────────────────────────

const LONG_TIP =
  "Keep your hips square to the target and drive through with your rear leg, " +
  "ensuring your torso stays upright throughout the full range of motion to " +
  "maximise power transfer and reduce knee stress on every stride.";

describe("ShareCard — tip text truncation", () => {
  it("renders the tip Text node with numberOfLines={2} when the tip is longer than 120 chars", () => {
    expect(LONG_TIP.length).toBeGreaterThan(120);

    const { UNSAFE_getAllByType } = render(
      <ShareCard analysis={ANALYSIS} topTip={LONG_TIP} />,
    );

    const { Text } = require("react-native");
    const textNodes = UNSAFE_getAllByType(Text);

    const tipNode = textNodes.find(
      (node: { props: { numberOfLines?: number; children?: unknown } }) =>
        node.props.numberOfLines === 2 &&
        node.props.children === LONG_TIP,
    );

    expect(tipNode).toBeDefined();
    expect(tipNode!.props.numberOfLines).toBe(2);
  });

  it("clamps short tips to the same numberOfLines={2} cap", () => {
    const { UNSAFE_getAllByType } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} />,
    );

    const { Text } = require("react-native");
    const textNodes = UNSAFE_getAllByType(Text);

    const tipNode = textNodes.find(
      (node: { props: { numberOfLines?: number; children?: unknown } }) =>
        node.props.numberOfLines === 2 &&
        node.props.children === TOP_TIP,
    );

    expect(tipNode).toBeDefined();
    expect(tipNode!.props.numberOfLines).toBe(2);
  });
});

// ─── 4. Title truncation ──────────────────────────────────────────────────────

const LONG_TITLE =
  "Championship 800m Final — National Indoor Athletics Track and Field Qualifier";

describe("ShareCard — title text truncation", () => {
  it("renders the title Text node with numberOfLines={1} when the title is longer than 60 characters", () => {
    expect(LONG_TITLE.length).toBeGreaterThan(60);

    const { UNSAFE_getAllByType } = render(
      <ShareCard analysis={{ ...ANALYSIS, title: LONG_TITLE }} />,
    );

    const { Text } = require("react-native");
    const textNodes = UNSAFE_getAllByType(Text);

    const titleNode = textNodes.find(
      (node: { props: { numberOfLines?: number; children?: unknown } }) =>
        node.props.numberOfLines === 1 &&
        node.props.children === LONG_TITLE,
    );

    expect(titleNode).toBeDefined();
    expect(titleNode!.props.numberOfLines).toBe(1);
  });

  it("clamps short titles to the same numberOfLines={1} cap", () => {
    const { UNSAFE_getAllByType } = render(
      <ShareCard analysis={ANALYSIS} />,
    );

    const { Text } = require("react-native");
    const textNodes = UNSAFE_getAllByType(Text);

    const titleNode = textNodes.find(
      (node: { props: { numberOfLines?: number; children?: unknown } }) =>
        node.props.numberOfLines === 1 &&
        node.props.children === ANALYSIS.title,
    );

    expect(titleNode).toBeDefined();
    expect(titleNode!.props.numberOfLines).toBe(1);
  });
});

// ─── 3. Capture-options contract ──────────────────────────────────────────────

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

// ─── 5. Accent colour override ────────────────────────────────────────────────
// Verifies that when `accent` is passed the palette uses the overridden colour
// in every element that derives from it: tip-strip background, sport badge,
// footer logo-mark, and icon circle.  The default dark-scheme accent (#00C2FF)
// must not appear in any of those slots.

describe("ShareCard — accent colour override", () => {
  const OCEAN_ACCENT = "#0ea5e9"; // Ocean theme — differs from both default accents

  it("forwards the custom accent to the tip-strip background", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} accent={OCEAN_ACCENT} />,
    );
    const json = JSON.stringify(toJSON());
    // tipStrip backgroundColor = accent + "18"
    expect(json).toContain(`${OCEAN_ACCENT}18`);
  });

  it("forwards the custom accent to the sport-badge background", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} accent={OCEAN_ACCENT} />,
    );
    const json = JSON.stringify(toJSON());
    // sportBadge backgroundColor = accent + "cc"
    expect(json).toContain(`${OCEAN_ACCENT}cc`);
  });

  it("forwards the custom accent to the footer logo-mark background", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} accent={OCEAN_ACCENT} />,
    );
    const json = JSON.stringify(toJSON());
    // logoMark backgroundColor = accent + "22"
    expect(json).toContain(`${OCEAN_ACCENT}22`);
  });

  it("forwards the custom accent to the thumbnail-fallback icon-circle background", () => {
    // No thumbnailUrl → fallback view with iconCircle is rendered
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} accent={OCEAN_ACCENT} />,
    );
    const json = JSON.stringify(toJSON());
    // iconCircle backgroundColor = accent + "22" (same suffix as logoMark)
    expect(json).toContain(`${OCEAN_ACCENT}22`);
  });

  it("replaces the default dark-scheme accent in all accent-derived slots", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} accent={OCEAN_ACCENT} />,
    );
    const json = JSON.stringify(toJSON());
    // SHARE_CARD_DARK.accent is "#00C2FF" — none of its derived values should appear
    expect(json).not.toContain("#00C2FF18"); // would be tipStrip bg without override
    expect(json).not.toContain("#00C2FFcc"); // would be sportBadge bg without override
    expect(json).not.toContain("#00C2FF22"); // would be logoMark / iconCircle bg without override
  });

  it("replaces the default light-scheme accent when colorScheme=light", () => {
    const { toJSON } = render(
      <ShareCard
        analysis={ANALYSIS}
        topTip={TOP_TIP}
        colorScheme="light"
        accent={OCEAN_ACCENT}
      />,
    );
    const json = JSON.stringify(toJSON());
    // Override must work on top of the light palette too
    expect(json).toContain(`${OCEAN_ACCENT}18`);  // tipStrip bg
    expect(json).toContain(`${OCEAN_ACCENT}cc`);  // sportBadge bg
    expect(json).toContain(`${OCEAN_ACCENT}22`);  // logoMark / iconCircle bg
    // SHARE_CARD_LIGHT.accent is also "#00C2FF"
    expect(json).not.toContain("#00C2FF18");
    expect(json).not.toContain("#00C2FFcc");
    expect(json).not.toContain("#00C2FF22");
  });

  it("snapshot: dark scheme + Ocean accent + tip", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} accent={OCEAN_ACCENT} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});

// ─── 3. Snapshot tests ────────────────────────────────────────────────────────

describe("ShareCard — snapshots", () => {
  it("matches snapshot: dark scheme, with tip, no thumbnail", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} colorScheme="dark" />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches snapshot: light scheme, with tip, no thumbnail", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} topTip={TOP_TIP} colorScheme="light" />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches snapshot: dark scheme, no tip, no thumbnail", () => {
    const { toJSON } = render(
      <ShareCard analysis={ANALYSIS} colorScheme="dark" />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches snapshot: dark scheme, with thumbnail", () => {
    const analysisWithThumb: AnalysisRecord = {
      ...ANALYSIS,
      thumbnailUrl: "https://example.com/thumb.jpg",
    };
    const { toJSON } = render(
      <ShareCard
        analysis={analysisWithThumb}
        topTip={TOP_TIP}
        colorScheme="dark"
      />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
