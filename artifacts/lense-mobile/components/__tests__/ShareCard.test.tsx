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
