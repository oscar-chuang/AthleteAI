import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Feather: (props: object) => <View {...props} /> };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    foreground: "#fff",
    primary: "#2F7BFF",
    primaryForeground: "#ffffff",
    border: "#333",
    card: "#111",
    muted: "#1a1a1a",
    mutedForeground: "#888",
    success: "#22C55E",
    destructive: "#EF4444",
    surface3: "#171A1F",
  }),
}));

jest.mock("@/assets/recording-tips/good.png",     () => 1, { virtual: true });
jest.mock("@/assets/recording-tips/too-far.png",  () => 2, { virtual: true });
jest.mock("@/assets/recording-tips/cropped.png",  () => 3, { virtual: true });
jest.mock("@/assets/recording-tips/dark.png",     () => 4, { virtual: true });

import RecordingTipsModal from "@/components/RecordingTipsModal";
import { BEST_PRACTICES, COMMON_MISTAKES, EXAMPLE_CARDS } from "@/components/recordingGuidance/config";

const noop = () => {};

describe("RecordingTipsModal — visibility", () => {
  it("does not render content when visible=false", () => {
    const { queryByText } = render(
      <RecordingTipsModal visible={false} onContinue={noop} />,
    );
    expect(queryByText("Recording Tips")).toBeNull();
  });

  it("renders the header when visible=true", () => {
    const { getByText } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(getByText("Recording Tips")).toBeTruthy();
  });
});

describe("RecordingTipsModal — mandatory acknowledge gate", () => {
  it("Continue button is disabled before the checkbox is ticked", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(true);
  });

  it("Continue button enables after ticking the acknowledgement checkbox", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    fireEvent.press(getByRole("checkbox"));
    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(false);
  });

  it("onContinue is NOT called when Continue is pressed without ticking the checkbox", () => {
    const onContinue = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={onContinue} />,
    );
    fireEvent.press(getByRole("button", { name: "Continue" }));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("onContinue IS called after ticking checkbox and pressing Continue", async () => {
    const onContinue = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={onContinue} />,
    );
    fireEvent.press(getByRole("checkbox"));
    await act(async () => { fireEvent.press(getByRole("button", { name: "Continue" })); });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("checkbox has correct accessibilityRole and initial state", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const cb = getByRole("checkbox");
    expect(cb.props.accessibilityRole).toBe("checkbox");
    expect(cb.props.accessibilityState?.checked).toBe(false);
  });

  it("checkbox checked state becomes true after pressing", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    fireEvent.press(getByRole("checkbox"));
    expect(getByRole("checkbox").props.accessibilityState?.checked).toBe(true);
  });
});

describe("RecordingTipsModal — no close / dismiss escape hatch", () => {
  it("there is no X / close button on the guidance screen", () => {
    const { queryByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("the only interactive button rendered is Continue", () => {
    const { getAllByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const buttons = getAllByRole("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0]!.props.accessibilityLabel).toBe("Continue");
  });
});

describe("RecordingTipsModal — scroll does NOT unlock Continue", () => {
  it("scrolling past the threshold does not enable Continue without checkbox", () => {
    const { getByRole, UNSAFE_getByType } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const { ScrollView } = require("react-native");
    fireEvent.scroll(UNSAFE_getByType(ScrollView), {
      nativeEvent: { contentOffset: { y: 400 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 600 } },
    });
    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(true);
  });

  it("scrolling below threshold does not enable Continue without checkbox", () => {
    const { getByRole, UNSAFE_getByType } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const { ScrollView } = require("react-native");
    fireEvent.scroll(UNSAFE_getByType(ScrollView), {
      nativeEvent: { contentOffset: { y: 100 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 600 } },
    });
    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(true);
  });
});

describe("RecordingTipsModal — loading state", () => {
  it("renders skeleton boxes when loading=true", () => {
    const { UNSAFE_getAllByType } = render(
      <RecordingTipsModal visible onContinue={noop} loading />,
    );
    const { Animated } = require("react-native");
    expect(UNSAFE_getAllByType(Animated.View).length).toBeGreaterThan(0);
  });

  it("does not render tip text when loading=true", () => {
    const { queryByText } = render(
      <RecordingTipsModal visible onContinue={noop} loading />,
    );
    expect(queryByText("Best Practices")).toBeNull();
    expect(queryByText("Common Mistakes")).toBeNull();
  });
});

describe("RecordingTipsModal — empty state", () => {
  it("renders graceful fallback heading when tip arrays are empty", () => {
    const { getByText } = render(
      <RecordingTipsModal
        visible
        onContinue={noop}
        bestPractices={[]}
        commonMistakes={[]}
        exampleCards={[]}
      />,
    );
    expect(getByText(/No tips available/i)).toBeTruthy();
  });

  it("still renders header and footer in empty state", () => {
    const { getByText, getByRole } = render(
      <RecordingTipsModal
        visible
        onContinue={noop}
        bestPractices={[]}
        commonMistakes={[]}
        exampleCards={[]}
      />,
    );
    expect(getByText("Recording Tips")).toBeTruthy();
    expect(getByRole("checkbox")).toBeTruthy();
    expect(getByRole("button", { name: "Continue" })).toBeTruthy();
  });
});

describe("RecordingTipsModal — example images", () => {
  it("renders exactly four accessible image components", () => {
    const { getAllByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(getAllByRole("image")).toHaveLength(EXAMPLE_CARDS.length);
  });

  it("exactly one card carries the 'Do this' badge", () => {
    const { getAllByText } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(getAllByText("Do this")).toHaveLength(1);
  });

  it("exactly three cards carry the 'Avoid' badge", () => {
    const { getAllByText } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    expect(getAllByText("Avoid")).toHaveLength(EXAMPLE_CARDS.filter((c) => !c.good).length);
  });
});

describe("RecordingTipsModal — sub-component accessibility", () => {
  it("GuidanceSectionHeader elements have accessibilityRole=header", () => {
    const { getAllByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const headers = getAllByRole("header");
    expect(headers.length).toBeGreaterThanOrEqual(3);
  });

  it("tip rows have accessibilityRole=text", () => {
    const { getAllByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const textNodes = getAllByRole("text");
    expect(textNodes.length).toBeGreaterThanOrEqual(BEST_PRACTICES.length + COMMON_MISTAKES.length);
  });

  it("AcknowledgeCheckbox has accessibilityHint", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const cb = getByRole("checkbox");
    expect(cb.props.accessibilityHint).toBeTruthy();
  });

  it("Continue button has accessibilityHint", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const btn = getByRole("button", { name: "Continue" });
    expect(btn.props.accessibilityHint).toBeTruthy();
  });
});

describe("RecordingTipsModal — testID propagation", () => {
  it("forwards testID to the Modal root", () => {
    const { getByTestId } = render(
      <RecordingTipsModal visible onContinue={noop} testID="guidance-modal" />,
    );
    expect(getByTestId("guidance-modal")).toBeTruthy();
  });
});

describe("RecordingTipsModal — no Don't show again toggle", () => {
  it("does not render a Switch element", () => {
    const { UNSAFE_queryAllByType } = render(
      <RecordingTipsModal visible onContinue={noop} />,
    );
    const { Switch } = require("react-native");
    expect(UNSAFE_queryAllByType(Switch)).toHaveLength(0);
  });
});
