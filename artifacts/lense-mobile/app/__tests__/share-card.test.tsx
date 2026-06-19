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

import { ShareCard } from "@/components/analysis/ShareCard";

// ─── Tests ────────────────────────────────────────────────────────────────────

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
