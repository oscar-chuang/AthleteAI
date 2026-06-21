/**
 * Jest tests for the ShareCard (components/analysis/ShareCard.tsx).
 *
 * 1. Tip strip is rendered with the correct text when topTip is supplied.
 * 2. Tip strip is absent when topTip is omitted.
 * 3. The message-circle icon appears only when topTip is provided.
 */

import React from "react";
import { render } from "@testing-library/react-native";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("react-native-view-shot", () => {
  const { forwardRef } = require("react");
  const { View } = require("react-native");
  const ViewShot = forwardRef(
    ({ children, style }: { children?: React.ReactNode; style?: unknown }, _ref: unknown) => (
      <View style={style as object}>{children}</View>
    ),
  );
  ViewShot.displayName = "ViewShot";
  return { __esModule: true, default: ViewShot };
});

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, size }: { name: string; size: number }) => {
    const { View } = require("react-native");
    return <View testID={`feather-${name}-${size}`} />;
  },
}));

// ─── Component under test (imported after mocks) ──────────────────────────────

import { ShareCard } from "@/components/analysis/ShareCard";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ANALYSIS = {
  id: "a1",
  userId: "u1",
  title: "Running session",
  sport: "running",
  status: "complete" as const,
  uploadedAt: "2026-06-19T00:00:00.000Z",
  overallScore: 78,
  techniqueScore: 78,
  powerScore: 72,
  balanceScore: 80,
  consistencyScore: 70,
  mobilityScore: 75,
  speedScore: 68,
  strengths: [],
  improvements: [],
};

const SHORT_TIP = "Keep your hips high and drive your knees forward.";

// ─── 1. Tip strip renders with correct text ───────────────────────────────────

describe("ShareCard — topTip renders correctly", () => {
  it("shows the tip text when topTip is provided", () => {
    const { getByText } = render(<ShareCard analysis={BASE_ANALYSIS} topTip={SHORT_TIP} />);
    expect(getByText(SHORT_TIP)).toBeTruthy();
  });

  it("renders the message-circle icon when topTip is provided", () => {
    const { getByTestId } = render(<ShareCard analysis={BASE_ANALYSIS} topTip={SHORT_TIP} />);
    expect(getByTestId("feather-message-circle-11")).toBeTruthy();
  });
});

// ─── 2. Tip strip is absent when topTip is omitted ───────────────────────────

describe("ShareCard — tip strip absent when topTip is undefined", () => {
  it("does not render the tip text when topTip is omitted", () => {
    const { queryByText } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    expect(queryByText(SHORT_TIP)).toBeNull();
  });

  it("does not render the message-circle icon when topTip is omitted", () => {
    const { queryByTestId } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    expect(queryByTestId("feather-message-circle-11")).toBeNull();
  });
});

// ─── 3. Sport label is always title-cased ─────────────────────────────────────

describe("ShareCard — sport label title case", () => {
  it("renders a lowercase raw sport value in title case", () => {
    const { getAllByText } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    expect(getAllByText("Running").length).toBeGreaterThan(0);
  });

  it("never renders the raw lowercase sport value", () => {
    const { queryByText } = render(<ShareCard analysis={BASE_ANALYSIS} />);
    expect(queryByText("running")).toBeNull();
  });

  it("renders 'Swimming' when sport is 'swimming'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "swimming" }} />,
    );
    expect(getAllByText("Swimming").length).toBeGreaterThan(0);
  });

  it("does not render the raw 'swimming' value", () => {
    const { queryByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "swimming" }} />,
    );
    expect(queryByText("swimming")).toBeNull();
  });

  it("renders a multi-word sport in title case", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "weight lifting" }} />,
    );
    expect(getAllByText("Weight Lifting").length).toBeGreaterThan(0);
  });

  it("does not render the raw multi-word sport value", () => {
    const { queryByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "weight lifting" }} />,
    );
    expect(queryByText("weight lifting")).toBeNull();
  });

  it("renders 'Basketball' when sport is 'basketball'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "basketball" }} />,
    );
    expect(getAllByText("Basketball").length).toBeGreaterThan(0);
  });

  it("renders 'Yoga' when sport is 'yoga'", () => {
    const { getAllByText } = render(
      <ShareCard analysis={{ ...BASE_ANALYSIS, sport: "yoga" }} />,
    );
    expect(getAllByText("Yoga").length).toBeGreaterThan(0);
  });
});
