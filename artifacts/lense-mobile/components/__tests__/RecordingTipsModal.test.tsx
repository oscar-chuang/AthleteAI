import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
});
