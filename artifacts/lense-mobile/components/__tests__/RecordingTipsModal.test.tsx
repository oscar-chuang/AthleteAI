import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GOOD_IMG    = require("@/assets/recording-tips/good.png");
const TOO_FAR_IMG = require("@/assets/recording-tips/too-far.png");
const CROPPED_IMG = require("@/assets/recording-tips/cropped.png");
const DARK_IMG    = require("@/assets/recording-tips/dark.png");

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Feather: View };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    foreground: "#fff",
    primary: "#6c63ff",
    border: "#333",
    card: "#111",
    mutedForeground: "#888",
    success: "#22c55e",
    destructive: "#ef4444",
  }),
}));

import RecordingTipsModal, { RECORDING_TIPS_KEY } from "@/components/RecordingTipsModal";

const noop = () => {};

describe("RecordingTipsModal — upload gate", () => {
  beforeEach(() => {
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

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

  it("does NOT write to AsyncStorage when 'Don't show again' toggle is off", async () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );

    fireEvent.press(getByRole("checkbox"));
    await act(async () => { fireEvent.press(getByRole("button", { name: "Continue" })); });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("writes recording_tips_dismissed to AsyncStorage when 'Don't show again' is enabled and Continue is pressed", async () => {
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );

    fireEvent.press(getByRole("checkbox"));

    const toggle = getByRole("switch");
    fireEvent(toggle, "valueChange", true);

    await act(async () => { fireEvent.press(getByRole("button", { name: "Continue" })); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECORDING_TIPS_KEY, "true");
  });

  it("resets acknowledged and dontShowAgain when the modal is closed and reopened", () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <RecordingTipsModal visible onClose={onClose} onContinue={noop} />,
    );

    fireEvent.press(getByRole("checkbox"));
    fireEvent(getByRole("switch"), "valueChange", true);

    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(false);
    expect(getByRole("switch").props.value).toBe(true);

    act(() => { fireEvent.press(getByRole("button", { name: "Close" })); });

    expect(onClose).toHaveBeenCalledTimes(1);

    expect(getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled).toBe(true);
    expect(getByRole("switch").props.value).toBe(false);
  });
});

describe("RecordingTipsModal — example images", () => {
  function getExampleImages(renderResult: ReturnType<typeof render>) {
    const { Image } = require("react-native");
    return renderResult.UNSAFE_getAllByType(Image);
  }

  it("renders exactly four Image components", () => {
    const result = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    expect(getExampleImages(result)).toHaveLength(4);
  });

  it("the 'Full body in frame' image loads good.png", () => {
    const result = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const imgs = getExampleImages(result);
    const img = imgs.find((el: { props: { accessibilityLabel?: string } }) =>
      el.props.accessibilityLabel === "Full body in frame",
    );
    expect(img).toBeTruthy();
    expect(img!.props.source).toEqual(GOOD_IMG);
  });

  it("the 'Too far away' image loads too-far.png", () => {
    const result = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const imgs = getExampleImages(result);
    const img = imgs.find((el: { props: { accessibilityLabel?: string } }) =>
      el.props.accessibilityLabel === "Too far away",
    );
    expect(img).toBeTruthy();
    expect(img!.props.source).toEqual(TOO_FAR_IMG);
  });

  it("the 'Limbs cropped' image loads cropped.png", () => {
    const result = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const imgs = getExampleImages(result);
    const img = imgs.find((el: { props: { accessibilityLabel?: string } }) =>
      el.props.accessibilityLabel === "Limbs cropped",
    );
    expect(img).toBeTruthy();
    expect(img!.props.source).toEqual(CROPPED_IMG);
  });

  it("the 'Poor lighting' image loads dark.png", () => {
    const result = render(
      <RecordingTipsModal visible onClose={noop} onContinue={noop} />,
    );
    const imgs = getExampleImages(result);
    const img = imgs.find((el: { props: { accessibilityLabel?: string } }) =>
      el.props.accessibilityLabel === "Poor lighting",
    );
    expect(img).toBeTruthy();
    expect(img!.props.source).toEqual(DARK_IMG);
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
