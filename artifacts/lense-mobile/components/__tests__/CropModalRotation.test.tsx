/**
 * Verifies that the crop position (scale + translation) survives a device
 * rotation, and that toggling the modal closed then reopened DOES reset it.
 *
 * ## What is being tested
 * CropModal's useEffect fires whenever `visible`, `imageWidth`, or
 * `imageHeight` changes.  When the dimensions change while the modal is
 * already open (i.e. a rotation event) the effect must:
 *   - rescale proportionally and clamp to the new minScale / MAX_SCALE range
 *   - clamp the existing translation to the new pan bounds
 *   - NOT zero-out position (that would feel like the image snapped to centre)
 *
 * When the modal goes from visible → hidden → visible the effect must:
 *   - reset scale to the initial fit-to-frame value
 *   - reset translateX / translateY to 0
 *
 * ## Strategy
 * We mock react-native-reanimated so useSharedValue() returns a plain
 * { value } object backed by React.useRef — giving us referential stability
 * across re-renders while letting the test read and write .value directly.
 * All captured shared-value refs are stored in `capturedSVs` (reset between
 * tests).  We also test computeCropRect as a pure function independently.
 */

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as ImageManipulator from "expo-image-manipulator";

// ─── Shared-value registry ────────────────────────────────────────────────────
// Populated by the useSharedValue mock below; cleared in beforeEach.
//
// Named indices match hook call order inside CropModal.tsx.  If the hook order
// ever changes these constants will need updating — but at least the failure
// will be obvious rather than silently testing the wrong value.

type SV = { value: number };
const capturedSVs: SV[] = [];

// Index of each shared value in capturedSVs (matches hook-call order in CropModal.tsx)
const SV_SCALE       = 0;
const SV_SAVED_SCALE = 1;
const SV_TX          = 2;
const SV_TY          = 3;
const SV_SAVED_TX    = 4;
const SV_SAVED_TY    = 5;

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");

  const AnimatedView = ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: object;
  }) => React.createElement(View, { style }, children);

  return {
    // __esModule: true is required so that Babel's interop treats `default`
    // as the default export.  Without it, `import Animated from "..."` gets
    // the entire module object, making Animated.View === undefined.
    __esModule: true,
    default: {
      View: AnimatedView,
      createAnimatedComponent: (C: React.ComponentType) => C,
    },
    useSharedValue: (initial: number): SV => {
      // React.useRef gives us referential stability across re-renders.
      // On first mount ref.current is null → we create the SV and push it.
      // On subsequent renders the same ref (and the same SV object) is returned.
      const ref = React.useRef(null) as { current: SV | null };
      if (ref.current === null) {
        ref.current = { value: initial };
        capturedSVs.push(ref.current);
      }
      return ref.current!;
    },
    useAnimatedStyle: (_updater: () => object) => ({}),
    withSpring: (v: number) => v,
    runOnJS:
      <T extends (...args: unknown[]) => unknown>(fn: T) =>
      fn,
  };
});

// Gesture handler — needs to support fluent chaining (.onUpdate().onEnd() etc.)
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  function makeChainable() {
    const handler: Record<string, unknown> = {};
    const chain = () => handler;
    [
      "onBegin",
      "onUpdate",
      "onEnd",
      "onStart",
      "onFinalize",
      "minPointers",
      "maxPointers",
      "enabled",
      "simultaneousWithExternalGesture",
    ].forEach((m) => {
      handler[m] = chain;
    });
    return handler;
  }

  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, {}, children),
    Gesture: {
      Pan: makeChainable,
      Pinch: makeChainable,
      Simultaneous: (..._args: unknown[]) => ({}),
    },
  };
});

jest.mock("expo-image", () => ({ Image: () => null }));

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

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

// ─── Component + pure function under test ─────────────────────────────────────

import { CropModal, computeCropRect } from "@/components/CropModal";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const noop = () => {};

interface Props {
  visible?: boolean;
  imageWidth?: number;
  imageHeight?: number;
}

function makeProps(overrides: Props = {}) {
  return {
    visible: true,
    imageUri: "file://photo.jpg",
    imageWidth: 800,
    imageHeight: 600,
    onConfirm: noop,
    onCancel: noop,
    ...overrides,
  };
}

// ─── computeCropRect — pure-function arithmetic ───────────────────────────────

describe("computeCropRect — pure function", () => {
  const CROP = 320;

  it("returns a rect with all fields ≥ 0 at default centre position", () => {
    const r = computeCropRect(800, 600, 1, 0, 0, CROP);
    expect(r.originX).toBeGreaterThanOrEqual(0);
    expect(r.originY).toBeGreaterThanOrEqual(0);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it("never lets originX exceed imageWidth − 1", () => {
    const r = computeCropRect(400, 400, 0.5, -300, -300, CROP);
    expect(r.originX).toBeLessThan(400);
  });

  it("never lets originY exceed imageHeight − 1", () => {
    const r = computeCropRect(400, 400, 0.5, 300, 300, CROP);
    expect(r.originY).toBeLessThan(400);
  });

  it("width and height are always at least 1", () => {
    // Extreme negative translation pushes the image almost entirely off-frame.
    const r = computeCropRect(50, 50, 10, -200, -200, CROP);
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it("width never exceeds imageWidth", () => {
    const r = computeCropRect(400, 400, 0.5, 0, 0, CROP);
    expect(r.width).toBeLessThanOrEqual(400);
  });

  it("zooming in (larger scale) captures fewer source pixels", () => {
    const lo = computeCropRect(800, 600, 1, 0, 0, CROP);
    const hi = computeCropRect(800, 600, 3, 0, 0, CROP);
    expect(hi.width).toBeLessThan(lo.width);
    expect(hi.height).toBeLessThan(lo.height);
  });

  it("is centred on the image when translation is zero and scale is symmetric", () => {
    const r = computeCropRect(800, 600, 2, 0, 0, CROP);
    const centreX = r.originX + r.width / 2;
    const centreY = r.originY + r.height / 2;
    expect(centreX).toBeCloseTo(400, 0);
    expect(centreY).toBeCloseTo(300, 0);
  });
});

// ─── Rotation: position is preserved, not zeroed ─────────────────────────────

describe("CropModal — device rotation preserves crop position", () => {
  beforeEach(() => {
    capturedSVs.length = 0;
  });

  it("scale and translation are NOT reset to zero when dimensions swap while visible", () => {
    // Start: landscape 800 × 600
    const { rerender } = render(<CropModal {...makeProps()} />);

    // Simulate a pan+zoom by writing directly to the shared values captured on
    // first mount.  Named constants (SV_SCALE etc.) map to hook-call order.
    act(() => {
      capturedSVs[SV_SCALE].value       = 2.5; // zoomed in
      capturedSVs[SV_SAVED_SCALE].value = 2.5;
      capturedSVs[SV_TX].value          = 30;  // panned right
      capturedSVs[SV_TY].value          = 20;  // panned down
      capturedSVs[SV_SAVED_TX].value    = 30;
      capturedSVs[SV_SAVED_TY].value    = 20;
    });

    // Simulate device rotation: landscape → portrait (swap w/h)
    act(() => {
      rerender(<CropModal {...makeProps({ imageWidth: 600, imageHeight: 800 })} />);
    });

    // The rotation useEffect must clamp — but must NOT zero out the position.
    expect(capturedSVs[SV_SCALE].value).toBeGreaterThan(0); // scale still positive
    expect(capturedSVs[SV_TX].value).not.toBe(0);           // translateX survived
    expect(capturedSVs[SV_TY].value).not.toBe(0);           // translateY survived
  });

  it("out-of-bounds translation is clamped to the new pan envelope after rotation", () => {
    // Start: landscape 800 × 600
    const { rerender } = render(<CropModal {...makeProps()} />);

    act(() => {
      // Scale of 1.5 on a 600-wide portrait: halfExtraW = (600*1.5 - 320)/2 = 290
      // A translateX of ±1000 is far outside that envelope.
      capturedSVs[SV_SCALE].value       = 1.5;
      capturedSVs[SV_SAVED_SCALE].value = 1.5;
      capturedSVs[SV_TX].value          = 1000; // out-of-bounds positive
      capturedSVs[SV_TY].value          = 1000;
      capturedSVs[SV_SAVED_TX].value    = 1000;
      capturedSVs[SV_SAVED_TY].value    = 1000;
    });

    // Rotate to portrait
    act(() => {
      rerender(<CropModal {...makeProps({ imageWidth: 600, imageHeight: 800 })} />);
    });

    const newScale  = capturedSVs[SV_SCALE].value;
    const halfExtraW = Math.max(0, (600 * newScale - 320) / 2);
    const halfExtraH = Math.max(0, (800 * newScale - 320) / 2);
    const eps        = 0.5; // rounding tolerance

    // After the effect runs translateX must be inside [-halfExtraW, +halfExtraW]
    expect(capturedSVs[SV_TX].value).toBeLessThanOrEqual(halfExtraW + eps);
    expect(capturedSVs[SV_TX].value).toBeGreaterThanOrEqual(-halfExtraW - eps);

    // Same bilateral check for translateY
    expect(capturedSVs[SV_TY].value).toBeLessThanOrEqual(halfExtraH + eps);
    expect(capturedSVs[SV_TY].value).toBeGreaterThanOrEqual(-halfExtraH - eps);
  });

  it("a second rotation back to landscape still preserves a non-zero position", () => {
    const { rerender } = render(<CropModal {...makeProps()} />);

    act(() => {
      capturedSVs[SV_SCALE].value       = 2.0;
      capturedSVs[SV_SAVED_SCALE].value = 2.0;
      capturedSVs[SV_TX].value          = 25;
      capturedSVs[SV_TY].value          = 15;
      capturedSVs[SV_SAVED_TX].value    = 25;
      capturedSVs[SV_SAVED_TY].value    = 15;
    });

    // First rotation: landscape → portrait
    act(() => {
      rerender(<CropModal {...makeProps({ imageWidth: 600, imageHeight: 800 })} />);
    });

    // Second rotation: portrait → landscape again
    act(() => {
      rerender(<CropModal {...makeProps({ imageWidth: 800, imageHeight: 600 })} />);
    });

    expect(capturedSVs[SV_SCALE].value).toBeGreaterThan(0);
    // Translation is within valid landscape bounds — generous enough that 25 is kept.
    expect(capturedSVs[SV_TX].value).not.toBe(0);
    expect(capturedSVs[SV_TY].value).not.toBe(0);
  });
});

// ─── Regression guard: visible false → true DOES reset position ───────────────

describe("CropModal — reopening the modal resets crop position", () => {
  beforeEach(() => {
    capturedSVs.length = 0;
  });

  it("resets scale to initial fit-to-frame and translation to 0 when closed then reopened", () => {
    const { rerender } = render(<CropModal {...makeProps()} />);

    // Pan + zoom
    act(() => {
      capturedSVs[SV_SCALE].value       = 3.0;
      capturedSVs[SV_SAVED_SCALE].value = 3.0;
      capturedSVs[SV_TX].value          = 50;
      capturedSVs[SV_TY].value          = 40;
      capturedSVs[SV_SAVED_TX].value    = 50;
      capturedSVs[SV_SAVED_TY].value    = 40;
    });

    // Close the modal (visible = false)
    act(() => {
      rerender(<CropModal {...makeProps({ visible: false })} />);
    });

    // Reopen the modal (visible = true)
    act(() => {
      rerender(<CropModal {...makeProps({ visible: true })} />);
    });

    // On open the effect resets values: scale → initial minScale, translation → 0
    // CROP_SIZE in test env = Math.min(375 - 48, 320) = 320
    // For 800 × 600: minScale = Math.max(320/800, 320/600) ≈ 0.533
    const expectedMinScale = Math.max(320 / 800, 320 / 600);
    expect(capturedSVs[SV_SCALE].value).toBeCloseTo(expectedMinScale, 3);
    expect(capturedSVs[SV_TX].value).toBe(0); // translateX reset
    expect(capturedSVs[SV_TY].value).toBe(0); // translateY reset
  });

  it("dimension change while modal is CLOSED does not trigger the preserve-on-rotation path", () => {
    // Start visible, set some state
    const { rerender } = render(<CropModal {...makeProps()} />);

    act(() => {
      capturedSVs[SV_SCALE].value = 2.0;
      capturedSVs[SV_TX].value    = 30;
      capturedSVs[SV_TY].value    = 20;
    });

    // Close the modal
    act(() => {
      rerender(<CropModal {...makeProps({ visible: false })} />);
    });

    // Change dimensions while closed — this should NOT trigger the rotation path
    act(() => {
      rerender(
        <CropModal
          {...makeProps({ visible: false, imageWidth: 600, imageHeight: 800 })}
        />,
      );
    });

    // Reopen — the open-reset path should fire (justOpened = true)
    act(() => {
      rerender(
        <CropModal
          {...makeProps({ visible: true, imageWidth: 600, imageHeight: 800 })}
        />,
      );
    });

    // Values must be reset (open always resets), not the old pan/zoom state
    expect(capturedSVs[SV_TX].value).toBe(0);
    expect(capturedSVs[SV_TY].value).toBe(0);
    const expectedMinScale = Math.max(320 / 600, 320 / 800);
    expect(capturedSVs[SV_SCALE].value).toBeCloseTo(expectedMinScale, 3);
  });
});

// ─── 'Use Photo' crops at the exact pan/zoom position ────────────────────────
//
// Regression guard: a future refactor of handleConfirm must not silently
// produce wrong crop coordinates.  We set known shared values, press the
// button, and assert that manipulateAsync receives the crop rect that
// computeCropRect would compute for those exact values.
//
// CROP_SIZE in the RN test environment:
//   Dimensions.get("window").width defaults to 375 → Math.min(375-48, 320) = 320

describe("CropModal — 'Use Photo' passes the correct crop rect to ImageManipulator", () => {
  // The manual mock in __mocks__/expo-image-manipulator.js exposes manipulateAsync
  // as a jest.fn().  Importing via the namespace gives us a reference to spy on.
  const mockManipulate = ImageManipulator.manipulateAsync as jest.Mock;

  beforeEach(() => {
    capturedSVs.length = 0;
    mockManipulate.mockClear();
  });

  it("crop originX/originY/width/height match computeCropRect for scale=2, tx=30, ty=20", async () => {
    const IMAGE_W = 800;
    const IMAGE_H = 600;
    const TEST_CROP_SIZE = 320; // Math.min(375-48, 320)

    const { findByText } = render(
      <CropModal {...makeProps({ imageWidth: IMAGE_W, imageHeight: IMAGE_H })} />,
    );

    // Write known pan/zoom state directly to the shared values.
    // Named constants match hook-call order; see top of file.
    act(() => {
      capturedSVs[SV_SCALE].value = 2;
      capturedSVs[SV_TX].value    = 30;
      capturedSVs[SV_TY].value    = 20;
    });

    // Press "Use Photo" — triggers handleConfirm (async)
    const btn = await findByText("Use Photo");
    fireEvent.press(btn);

    // Wait for the async ImageManipulator call to resolve
    await waitFor(() => {
      expect(mockManipulate).toHaveBeenCalledTimes(1);
    });

    // The first argument to the first action in the actions array is the crop step.
    const [_uri, actions] = mockManipulate.mock.calls[0] as [
      string,
      Array<{ crop?: object }>,
      object,
    ];
    const cropStep = actions[0] as { crop: { originX: number; originY: number; width: number; height: number } };

    const expected = computeCropRect(IMAGE_W, IMAGE_H, 2, 30, 20, TEST_CROP_SIZE);
    expect(cropStep.crop).toEqual(expected);
  });

  it("crop rect is centred on the image when translation is zero", async () => {
    const IMAGE_W = 800;
    const IMAGE_H = 600;
    const TEST_CROP_SIZE = 320;
    const SCALE = 2;

    const { findByText } = render(
      <CropModal {...makeProps({ imageWidth: IMAGE_W, imageHeight: IMAGE_H })} />,
    );

    act(() => {
      capturedSVs[SV_SCALE].value = SCALE;
      capturedSVs[SV_TX].value    = 0;
      capturedSVs[SV_TY].value    = 0;
    });

    const btn = await findByText("Use Photo");
    fireEvent.press(btn);

    await waitFor(() => {
      expect(mockManipulate).toHaveBeenCalledTimes(1);
    });

    const [_uri, actions] = mockManipulate.mock.calls[0] as [
      string,
      Array<{ crop?: object }>,
      object,
    ];
    const cropStep = actions[0] as { crop: { originX: number; originY: number; width: number; height: number } };

    const expected = computeCropRect(IMAGE_W, IMAGE_H, SCALE, 0, 0, TEST_CROP_SIZE);
    expect(cropStep.crop).toEqual(expected);

    // With tx=0 ty=0 the crop must be centred on the image.
    const centreX = cropStep.crop.originX + cropStep.crop.width / 2;
    const centreY = cropStep.crop.originY + cropStep.crop.height / 2;
    expect(centreX).toBeCloseTo(IMAGE_W / 2, 0);
    expect(centreY).toBeCloseTo(IMAGE_H / 2, 0);
  });

  it("a large pan offset shifts the crop rect accordingly", async () => {
    const IMAGE_W = 1000;
    const IMAGE_H = 1000;
    const TEST_CROP_SIZE = 320;
    const SCALE = 3;
    const TX = -80;
    const TY = 50;

    const { findByText } = render(
      <CropModal {...makeProps({ imageWidth: IMAGE_W, imageHeight: IMAGE_H })} />,
    );

    act(() => {
      capturedSVs[SV_SCALE].value = SCALE;
      capturedSVs[SV_TX].value    = TX;
      capturedSVs[SV_TY].value    = TY;
    });

    const btn = await findByText("Use Photo");
    fireEvent.press(btn);

    await waitFor(() => {
      expect(mockManipulate).toHaveBeenCalledTimes(1);
    });

    const [_uri, actions] = mockManipulate.mock.calls[0] as [
      string,
      Array<{ crop?: object }>,
      object,
    ];
    const cropStep = actions[0] as { crop: { originX: number; originY: number; width: number; height: number } };

    const expected = computeCropRect(IMAGE_W, IMAGE_H, SCALE, TX, TY, TEST_CROP_SIZE);
    expect(cropStep.crop).toEqual(expected);
  });
});
