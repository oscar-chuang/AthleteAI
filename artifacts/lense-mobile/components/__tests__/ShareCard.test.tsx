/**
 * Jest tests for the home-screen ShareCard (components/ShareCard.tsx).
 *
 * 1. Tip row is rendered with the correct text when topTip is supplied.
 * 2. Tip row is absent when topTip is omitted.
 * 3. Tips longer than 80 chars are truncated to 77 chars + "…".
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

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, size }: { name: string; size: number }) => {
    const { View } = require("react-native");
    return <View testID={`feather-${name}-${size}`} />;
  },
}));

// ─── Component under test (imported after mocks) ──────────────────────────────

import ShareCard from "@/components/ShareCard";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PROPS = {
  sessions: 3,
  weeklyGoal: 4,
  streakDays: 2,
  sport: "running",
};

const SHORT_TIP = "Keep your hips high and drive your knees forward.";

// 81 characters — one over the 80-char limit
const LONG_TIP =
  "Focus on landing mid-foot with a slight forward lean and keep your cadence above 170 spm.";

const EXPECTED_TRUNCATED = LONG_TIP.slice(0, 77) + "…";

// ─── 1. Tip row renders with correct text ─────────────────────────────────────

describe("ShareCard — topTip renders correctly", () => {
  it("shows the tip text when topTip is provided", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} topTip={SHORT_TIP} />);
    expect(getByText(SHORT_TIP)).toBeTruthy();
  });

  it("shows the 'Coach's top tip' label when topTip is provided", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} topTip={SHORT_TIP} />);
    expect(getByText("Coach's top tip")).toBeTruthy();
  });

  it("renders the message-circle icon when topTip is provided", () => {
    const { getByTestId } = render(<ShareCard {...BASE_PROPS} topTip={SHORT_TIP} />);
    expect(getByTestId("feather-message-circle-12")).toBeTruthy();
  });
});

// ─── 2. Tip row is absent when topTip is omitted ──────────────────────────────

describe("ShareCard — tip row absent when topTip is undefined", () => {
  it("does not render the tip text", () => {
    const { queryByText } = render(<ShareCard {...BASE_PROPS} />);
    expect(queryByText("Coach's top tip")).toBeNull();
  });

  it("does not render the message-circle icon", () => {
    const { queryByTestId } = render(<ShareCard {...BASE_PROPS} />);
    expect(queryByTestId("feather-message-circle-12")).toBeNull();
  });
});

// ─── 3. Long tips are truncated to 77 chars + ellipsis ───────────────────────

describe("ShareCard — topTip truncation", () => {
  it("renders the full tip when it is ≤ 80 chars", () => {
    const exactly80 = "A".repeat(80);
    const { getByText } = render(<ShareCard {...BASE_PROPS} topTip={exactly80} />);
    expect(getByText(exactly80)).toBeTruthy();
  });

  it("truncates to 77 chars + '…' when the tip exceeds 80 chars", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} topTip={LONG_TIP} />);
    expect(getByText(EXPECTED_TRUNCATED)).toBeTruthy();
  });

  it("does not render the raw long tip text when truncation applies", () => {
    const { queryByText } = render(<ShareCard {...BASE_PROPS} topTip={LONG_TIP} />);
    expect(queryByText(LONG_TIP)).toBeNull();
  });

  it("truncated text ends with the ellipsis character", () => {
    const { getByText } = render(<ShareCard {...BASE_PROPS} topTip={LONG_TIP} />);
    const el = getByText(EXPECTED_TRUNCATED);
    expect((el.props.children as string).endsWith("…")).toBe(true);
  });
});
