/**
 * Component tests: DeltaBadge renders the correct label text and color pill
 * for green (improved risk), red (worsened risk), and amber (unchanged risk,
 * angle moved) cases.
 *
 * Strategy:
 *   - Mount DeltaBadge directly via RNTL — no full-page mocking needed.
 *   - Supply a controlled DeltaBadgeInfo fixture for each color case.
 *   - Assert the rendered label text via getByText().
 *   - Assert the resolved style props on the container (borderColor,
 *     backgroundColor) and the text node (color) via getByTestId().
 *
 * The colour constants must match those in lib/sessionDelta.ts.  Any drift
 * between the constants and the component would surface here as a test failure.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { DeltaBadge } from "@/components/DeltaBadge";
import type { DeltaBadgeInfo } from "@/lib/sessionDelta";

// ── Colour constants (must match lib/sessionDelta.ts) ─────────────────────────

const GREEN = "#22c55e";
const RED   = "#ef4444";
const AMBER = "#f59e0b";

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeBadge(overrides: Partial<DeltaBadgeInfo>): DeltaBadgeInfo {
  return {
    jointKey:   "leftKnee",
    jointLabel: "L Knee",
    delta:      10,
    color:      GREEN,
    sign:       "+",
    ...overrides,
  };
}

// ── Label text ────────────────────────────────────────────────────────────────

describe("DeltaBadge — label text", () => {
  it("shows an up-arrow for a positive delta", () => {
    const { getByText } = render(
      <DeltaBadge info={makeBadge({ delta: 10, jointLabel: "L Knee", color: GREEN })} />,
    );
    expect(getByText("↑10° L Knee")).toBeTruthy();
  });

  it("shows a down-arrow for a negative delta", () => {
    const { getByText } = render(
      <DeltaBadge info={makeBadge({ delta: -15, jointLabel: "L Hip", color: RED })} />,
    );
    expect(getByText("↓15° L Hip")).toBeTruthy();
  });

  it("includes the joint label in the rendered text", () => {
    const { getByText } = render(
      <DeltaBadge info={makeBadge({ delta: 5, jointLabel: "R Knee", color: AMBER })} />,
    );
    expect(getByText("↑5° R Knee")).toBeTruthy();
  });

  it("uses absolute magnitude regardless of sign", () => {
    const { getByText } = render(
      <DeltaBadge info={makeBadge({ delta: -8, jointLabel: "L Hip", color: RED })} />,
    );
    expect(getByText("↓8° L Hip")).toBeTruthy();
  });
});

// ── Green badge (risk improved) ───────────────────────────────────────────────

describe("DeltaBadge — green badge (risk improved)", () => {
  function renderGreen() {
    return render(
      <DeltaBadge info={makeBadge({ color: GREEN, jointLabel: "L Knee", delta: 10 })} />,
    );
  }

  it("renders the expected label text", () => {
    const { getByText } = renderGreen();
    expect(getByText("↑10° L Knee")).toBeTruthy();
  });

  it("applies the green text colour to the badge label", () => {
    const { getByTestId } = renderGreen();
    expect(getByTestId("delta-badge-text").props.style).toMatchObject({ color: GREEN });
  });

  it("sets the green border colour on the container (color + '88')", () => {
    const { getByTestId } = renderGreen();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      borderColor: GREEN + "88",
    });
  });

  it("sets the green background colour on the container (color + '18')", () => {
    const { getByTestId } = renderGreen();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      backgroundColor: GREEN + "18",
    });
  });
});

// ── Red badge (risk worsened) ─────────────────────────────────────────────────

describe("DeltaBadge — red badge (risk worsened)", () => {
  function renderRed() {
    return render(
      <DeltaBadge info={makeBadge({ color: RED, jointLabel: "L Hip", delta: -15 })} />,
    );
  }

  it("renders the expected label text", () => {
    const { getByText } = renderRed();
    expect(getByText("↓15° L Hip")).toBeTruthy();
  });

  it("applies the red text colour to the badge label", () => {
    const { getByTestId } = renderRed();
    expect(getByTestId("delta-badge-text").props.style).toMatchObject({ color: RED });
  });

  it("sets the red border colour on the container (color + '88')", () => {
    const { getByTestId } = renderRed();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      borderColor: RED + "88",
    });
  });

  it("sets the red background colour on the container (color + '18')", () => {
    const { getByTestId } = renderRed();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      backgroundColor: RED + "18",
    });
  });
});

// ── Amber badge (risk unchanged, angle moved) ─────────────────────────────────

describe("DeltaBadge — amber badge (risk unchanged, angle moved)", () => {
  function renderAmber() {
    return render(
      <DeltaBadge info={makeBadge({ color: AMBER, jointLabel: "R Knee", delta: 5 })} />,
    );
  }

  it("renders the expected label text", () => {
    const { getByText } = renderAmber();
    expect(getByText("↑5° R Knee")).toBeTruthy();
  });

  it("applies the amber text colour to the badge label", () => {
    const { getByTestId } = renderAmber();
    expect(getByTestId("delta-badge-text").props.style).toMatchObject({ color: AMBER });
  });

  it("sets the amber border colour on the container (color + '88')", () => {
    const { getByTestId } = renderAmber();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      borderColor: AMBER + "88",
    });
  });

  it("sets the amber background colour on the container (color + '18')", () => {
    const { getByTestId } = renderAmber();
    expect(getByTestId("delta-badge").props.style).toMatchObject({
      backgroundColor: AMBER + "18",
    });
  });
});

// ── Tappable vs non-tappable ──────────────────────────────────────────────────

describe("DeltaBadge — tappable variant", () => {
  it("calls onPress when the badge is tapped", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <DeltaBadge
        info={makeBadge({ color: GREEN, delta: 10, jointLabel: "L Knee" })}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByTestId("delta-badge"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("still renders the correct label when tappable", () => {
    const { getByText } = render(
      <DeltaBadge
        info={makeBadge({ color: GREEN, delta: 10, jointLabel: "L Knee" })}
        onPress={jest.fn()}
      />,
    );
    expect(getByText("↑10° L Knee")).toBeTruthy();
  });
});
