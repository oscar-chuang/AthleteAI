import React, { useState } from "react";
import { TouchableOpacity, Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import type { AnalysisRecord } from "@/lib/api";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── Import after mocks ───────────────────────────────────────────────────────

import { ShareCard } from "@/components/analysis/ShareCard";

// ─── Minimal scheme-picker wrapper ───────────────────────────────────────────
// Mirrors only the slice of [id].tsx that matters: scheme state + picker buttons
// + the ShareCard preview.  We keep it here so the test is self-contained and
// doesn't need to mount the full 2 400-line analysis screen.

function SchemePicker({ analysis }: { analysis: AnalysisRecord }) {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");
  return (
    <>
      <TouchableOpacity testID="btn-dark"  onPress={() => setScheme("dark")}>
        <Text>Dark</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="btn-light" onPress={() => setScheme("light")}>
        <Text>Light</Text>
      </TouchableOpacity>
      <ShareCard analysis={analysis} colorScheme={scheme} />
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scheme toggle — ShareCard colorScheme updates on press", () => {
  it("defaults to the dark scheme on first render", () => {
    const { getByTestId, queryByTestId } = render(
      <SchemePicker analysis={BASE_ANALYSIS} />,
    );
    expect(getByTestId("share-card-dark")).not.toBeNull();
    expect(queryByTestId("share-card-light")).toBeNull();
  });

  it("switches to the light scheme when the Light button is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <SchemePicker analysis={BASE_ANALYSIS} />,
    );

    fireEvent.press(getByTestId("btn-light"));

    expect(getByTestId("share-card-light")).not.toBeNull();
    expect(queryByTestId("share-card-dark")).toBeNull();
  });

  it("restores the dark scheme when Dark is pressed after Light", () => {
    const { getByTestId, queryByTestId } = render(
      <SchemePicker analysis={BASE_ANALYSIS} />,
    );

    fireEvent.press(getByTestId("btn-light"));
    expect(getByTestId("share-card-light")).not.toBeNull();

    fireEvent.press(getByTestId("btn-dark"));
    expect(getByTestId("share-card-dark")).not.toBeNull();
    expect(queryByTestId("share-card-light")).toBeNull();
  });

  it("pressing Dark when already dark keeps the dark scheme", () => {
    const { getByTestId, queryByTestId } = render(
      <SchemePicker analysis={BASE_ANALYSIS} />,
    );

    fireEvent.press(getByTestId("btn-dark"));
    expect(getByTestId("share-card-dark")).not.toBeNull();
    expect(queryByTestId("share-card-light")).toBeNull();
  });

  it("pressing Light when already light keeps the light scheme", () => {
    const { getByTestId, queryByTestId } = render(
      <SchemePicker analysis={BASE_ANALYSIS} />,
    );

    fireEvent.press(getByTestId("btn-light"));
    fireEvent.press(getByTestId("btn-light"));
    expect(getByTestId("share-card-light")).not.toBeNull();
    expect(queryByTestId("share-card-dark")).toBeNull();
  });
});
