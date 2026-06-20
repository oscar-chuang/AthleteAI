import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// ─── Scheme picker with AsyncStorage persistence ──────────────────────────────
// Mirrors the persistence slice of [id].tsx: reads SHARE_CARD_SCHEME_KEY on
// mount and writes it back whenever the user presses a button.

const SHARE_CARD_SCHEME_KEY = "shareCardScheme";

function SchemePickerWithStorage({ analysis }: { analysis: AnalysisRecord }) {
  const [scheme, setScheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    AsyncStorage.getItem(SHARE_CARD_SCHEME_KEY)
      .then((saved) => {
        if (saved === "dark" || saved === "light") setScheme(saved);
      })
      .catch(() => {});
  }, []);

  function handleSchemeChange(s: "dark" | "light") {
    setScheme(s);
    AsyncStorage.setItem(SHARE_CARD_SCHEME_KEY, s).catch(() => {});
  }

  return (
    <>
      <TouchableOpacity testID="btn-dark"  onPress={() => handleSchemeChange("dark")}>
        <Text>Dark</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="btn-light" onPress={() => handleSchemeChange("light")}>
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

// ─── Persistence tests ────────────────────────────────────────────────────────

describe("Scheme picker — persisted preference (AsyncStorage)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("pre-selects 'light' when AsyncStorage holds 'light' before mount", async () => {
    await AsyncStorage.setItem(SHARE_CARD_SCHEME_KEY, "light");

    const { getByTestId, queryByTestId } = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    // The useEffect reads AsyncStorage asynchronously; wait for the state update.
    await waitFor(() => {
      expect(getByTestId("share-card-light")).not.toBeNull();
    });
    expect(queryByTestId("share-card-dark")).toBeNull();
  });

  it("defaults to 'dark' when AsyncStorage is empty", async () => {
    const { getByTestId } = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    // Give the effect a chance to run (it will find nothing and leave the default).
    await waitFor(() => {
      expect(getByTestId("share-card-dark")).not.toBeNull();
    });
  });

  it("saves the chosen scheme to AsyncStorage when a button is pressed", async () => {
    const { getByTestId } = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    fireEvent.press(getByTestId("btn-light"));

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem(SHARE_CARD_SCHEME_KEY);
      expect(stored).toBe("light");
    });
  });

  it("overwrites the stored value when the user switches scheme again", async () => {
    await AsyncStorage.setItem(SHARE_CARD_SCHEME_KEY, "light");

    const { getByTestId } = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    // Wait for the stored "light" to be applied.
    await waitFor(() => expect(getByTestId("share-card-light")).not.toBeNull());

    // Now switch to dark.
    fireEvent.press(getByTestId("btn-dark"));

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem(SHARE_CARD_SCHEME_KEY);
      expect(stored).toBe("dark");
    });
    expect(getByTestId("share-card-dark")).not.toBeNull();
  });
});

// ─── Reopen tests ─────────────────────────────────────────────────────────────
// These tests simulate the full close-and-reopen cycle by unmounting the picker
// (= closing the share sheet) and remounting it (= reopening).  The goal is to
// confirm that whatever scheme the user picked is still pre-selected the next
// time the sheet opens, rather than resetting to the "dark" default.

describe("Scheme picker — card style remembered when share sheet reopens", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("restores 'light' when the share sheet is closed and reopened after switching", async () => {
    // ── First open: mount, switch to light, then unmount (close sheet) ──────
    const firstOpen = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    // Wait for the initial effect to settle (default dark).
    await waitFor(() =>
      expect(firstOpen.getByTestId("share-card-dark")).not.toBeNull(),
    );

    // Switch to light — this also writes "light" to AsyncStorage.
    fireEvent.press(firstOpen.getByTestId("btn-light"));
    await waitFor(() =>
      expect(firstOpen.getByTestId("share-card-light")).not.toBeNull(),
    );

    // Unmount = close the share sheet.
    firstOpen.unmount();

    // ── Second open: remount and confirm light is pre-selected ───────────────
    const secondOpen = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    await waitFor(() =>
      expect(secondOpen.getByTestId("share-card-light")).not.toBeNull(),
    );
    expect(secondOpen.queryByTestId("share-card-dark")).toBeNull();
  });

  it("defaults to 'dark' on first open when no preference has been saved", async () => {
    // AsyncStorage is empty (cleared in beforeEach); this is a first-time user.
    const { getByTestId, queryByTestId } = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    // The effect runs but finds nothing — the default "dark" must remain.
    await waitFor(() =>
      expect(getByTestId("share-card-dark")).not.toBeNull(),
    );
    expect(queryByTestId("share-card-light")).toBeNull();
  });

  it("keeps 'dark' when the sheet is closed and reopened without changing scheme", async () => {
    // ── First open: mount, leave on default dark, then unmount ───────────────
    const firstOpen = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    await waitFor(() =>
      expect(firstOpen.getByTestId("share-card-dark")).not.toBeNull(),
    );

    // Press dark explicitly to ensure AsyncStorage has "dark" written.
    fireEvent.press(firstOpen.getByTestId("btn-dark"));
    await waitFor(async () => {
      const stored = await AsyncStorage.getItem(SHARE_CARD_SCHEME_KEY);
      expect(stored).toBe("dark");
    });

    firstOpen.unmount();

    // ── Second open: dark must still be pre-selected ─────────────────────────
    const secondOpen = render(
      <SchemePickerWithStorage analysis={BASE_ANALYSIS} />,
    );

    await waitFor(() =>
      expect(secondOpen.getByTestId("share-card-dark")).not.toBeNull(),
    );
    expect(secondOpen.queryByTestId("share-card-light")).toBeNull();
  });
});
