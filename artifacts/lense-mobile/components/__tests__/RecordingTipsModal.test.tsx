import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

const GOOD_IMG    = require("@/assets/recording-tips/good.png");
const TOO_FAR_IMG = require("@/assets/recording-tips/too-far.png");
const CROPPED_IMG = require("@/assets/recording-tips/cropped.png");
const DARK_IMG    = require("@/assets/recording-tips/dark.png");

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
    border: "#333",
    card: "#111",
    mutedForeground: "#888",
    success: "#22C55E",
    destructive: "#EF4444",
    surface3: "#171A1F",
  }),
}));

import RecordingTipsModal from "@/components/RecordingTipsModal";

const noop = () => {};

describe("RecordingTipsModal — upload gate", () => {
  it("Continue button is disabled before the checkbox is ticked", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const btn = getByRole("button", { name: "Continue" });
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("Continue button becomes enabled after ticking the acknowledgement checkbox", () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );

    fireEvent.press(getByRole("checkbox"));

    const btn = getByRole("button", { name: "Continue" });
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it("onContinue is NOT called when Continue is pressed without ticking the checkbox", () => {
    const onContinue = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={onContinue} />,
    );

    fireEvent.press(getByRole("button", { name: "Continue" }));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("onContinue IS called after the checkbox is ticked and Continue is pressed", async () => {
    const onContinue = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={onContinue} />,
    );

    fireEvent.press(getByRole("checkbox"));
    await act(async () => { fireEvent.press(getByRole("button", { name: "Continue" })); });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("resets acknowledged when the modal is closed", () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={onClose} onContinue={noop} />,
    );

    fireEvent.press(getByRole("checkbox"));

    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(false);

    act(() => { fireEvent.press(getByRole("button", { name: "Close" })); });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(true);
    expect(getByRole("checkbox").props.accessibilityState?.checked).toBe(false);
  });

  it("does not render a 'Don't show again' toggle", () => {
    const { UNSAFE_queryAllByType } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const { Switch } = require("react-native");
    expect(UNSAFE_queryAllByType(Switch)).toHaveLength(0);
  });
});

describe("RecordingTipsModal — example images", () => {
  it("renders exactly four accessible image components", () => {
    const { getAllByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    expect(getAllByRole("image")).toHaveLength(4);
  });

  it("the 'Full body in frame' image loads good.png", () => {
    const { getByLabelText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const img = getByLabelText("Full body in frame");
    expect(img.props.source).toEqual(GOOD_IMG);
  });

  it("the 'Too far away' image loads too-far.png", () => {
    const { getByLabelText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const img = getByLabelText("Too far away");
    expect(img.props.source).toEqual(TOO_FAR_IMG);
  });

  it("the 'Limbs cropped' image loads cropped.png", () => {
    const { getByLabelText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const img = getByLabelText("Limbs cropped");
    expect(img.props.source).toEqual(CROPPED_IMG);
  });

  it("the 'Poor lighting' image loads dark.png", () => {
    const { getByLabelText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const img = getByLabelText("Poor lighting");
    expect(img.props.source).toEqual(DARK_IMG);
  });

  it("exactly one card carries the 'Do this' badge (good.png card)", () => {
    const { getAllByText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    expect(getAllByText("Do this")).toHaveLength(1);
  });

  it("exactly three cards carry the 'Avoid' badge (the non-good cards)", () => {
    const { getAllByText } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    expect(getAllByText("Avoid")).toHaveLength(3);
  });
});
