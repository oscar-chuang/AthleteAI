import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

// ─── Dependency mocks ──────────────────────────────────────────────────────────

jest.mock("expo-image", () => ({
  Image: () => null,
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0a0a0a",
    foreground: "#f5f5f5",
    card: "#1a1a1a",
    border: "#2a2a2a",
    primary: "#6c63ff",
    mutedForeground: "#888888",
    destructive: "#ff4d6d",
    success: "#22c55e",
    radius: 12,
  }),
}));

const mockManipulateAsync = jest.fn();
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: "jpeg" },
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { CropModal, computeCropRect } from "@/components/CropModal";

// ─── Helpers ───────────────────────────────────────────────────────────────────

// jest-expo's Dimensions mock returns width=375; Math.min(375-48, 320) = 320.
const CROP_SIZE = 320;

async function flush(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {});
  }
}

const BASE_PROPS = {
  visible: true,
  imageUri: "file:///test/photo.jpg",
  imageWidth: 400,
  imageHeight: 400,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockManipulateAsync.mockResolvedValue({
    uri: "file:///cropped.jpg",
    base64: "abc123",
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. Pure crop-math unit tests — no React mounting required
// ═════════════════════════════════════════════════════════════════════════════

describe("computeCropRect — pure crop math", () => {
  it("square image at minScale (fills crop window exactly) → full-image crop", () => {
    // 400×400 image, scale = 320/400 = 0.8, centered
    const result = computeCropRect(400, 400, 0.8, 0, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 0, originY: 0, width: 400, height: 400 });
  });

  it("landscape image at minScale, centered → strips equal columns from both sides", () => {
    // 500×320 image, minScale = max(320/500, 320/320) = max(0.64, 1) = 1
    // scale=1, tx=0, ty=0
    // displayW=500, displayH=320; imgLeft=160+0-250=-90; originX=round(90/1)=90
    // cropW=round(min(320, 500-90))=320; result → x:90, w:320, y:0, h:320
    const result = computeCropRect(500, 320, 1, 0, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 90, originY: 0, width: 320, height: 320 });
  });

  it("portrait image at minScale, centered → strips equal rows from top and bottom", () => {
    // 320×500 image, minScale = max(320/320, 320/500) = 1
    // scale=1, tx=0, ty=0
    // displayH=500; imgTop=160-250=-90; originY=90; cropH=min(320,410)=320
    const result = computeCropRect(320, 500, 1, 0, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 0, originY: 90, width: 320, height: 320 });
  });

  it("panning right (positive tx) shifts focal area toward the left of the image", () => {
    // 500×320 image at scale=1, panned right by 40px
    // imgLeft = 160 + 40 - 250 = -50; originX = 50; cropW = min(320, 450) = 320
    const result = computeCropRect(500, 320, 1, 40, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 50, originY: 0, width: 320, height: 320 });
  });

  it("panning left (negative tx) shifts focal area toward the right of the image", () => {
    // 500×320 image at scale=1, panned left by 40px
    // imgLeft = 160 - 40 - 250 = -130; originX = 130; cropW = min(320, 370) = 320
    const result = computeCropRect(500, 320, 1, -40, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 130, originY: 0, width: 320, height: 320 });
  });

  it("panning down (positive ty) shifts focal area toward the top of the image", () => {
    // 320×500 image at scale=1, panned down by 40px
    // imgTop = 160 + 40 - 250 = -50; originY = 50; cropH = min(320, 450) = 320
    const result = computeCropRect(320, 500, 1, 0, 40, CROP_SIZE);
    expect(result).toEqual({ originX: 0, originY: 50, width: 320, height: 320 });
  });

  it("zooming in doubles scale → crops a quarter of the image in each axis", () => {
    // 400×400 image at scale=1.6 (double minScale), tx=0, ty=0
    // displayW=640, displayH=640
    // imgLeft=160-320=-160; originX=round(160/1.6)=100
    // cropW=round(min(200, 300))=200; cropH=200
    const result = computeCropRect(400, 400, 1.6, 0, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 100, originY: 100, width: 200, height: 200 });
  });

  it("zooming in with a translation offset produces the expected crop", () => {
    // 400×400 image, scale=1.6, panned so tx=40, ty=0
    // imgLeft = 160 + 40 - 320 = -120; originX = round(120/1.6) = round(75) = 75
    // cropW = round(min(200, 400-75)) = 200; result → x:75, y:100, w:200, h:200
    const result = computeCropRect(400, 400, 1.6, 40, 0, CROP_SIZE);
    expect(result).toEqual({ originX: 75, originY: 100, width: 200, height: 200 });
  });

  it("clamps originX to zero when image is panned past the leading edge", () => {
    // 400×400, scale=0.8, tx=+200 pushes the image far right of the crop window.
    // imgLeft = 160 + 200 - 160 = 200 (positive) → -imgLeft = -200 → originX = max(0, -250) = 0.
    // Safety clamp kicks in: the visible region starts at the left edge of the image.
    const result = computeCropRect(400, 400, 0.8, 200, 0, CROP_SIZE);
    expect(result.originX).toBe(0);
  });

  it("clamps crop width to 1 when image is nearly off-screen", () => {
    // Pathological: tiny image that is 1×1 in source
    const result = computeCropRect(1, 1, 320, 0, 0, CROP_SIZE);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Component integration tests
// ═════════════════════════════════════════════════════════════════════════════

describe("CropModal — cancel path", () => {
  it("pressing Cancel calls onCancel and does NOT call onConfirm", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const { getByText } = render(
      <CropModal {...BASE_PROPS} onConfirm={onConfirm} onCancel={onCancel} />
    );
    await flush();

    fireEvent.press(getByText("Cancel"));
    await flush();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mockManipulateAsync).not.toHaveBeenCalled();
  });

  it("modal does NOT call onCancel when Use Photo is pressed", async () => {
    const onCancel = jest.fn();

    const { getByText } = render(
      <CropModal {...BASE_PROPS} onCancel={onCancel} />
    );
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Use Photo"));
    });
    await flush();

    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("CropModal — Use Photo calls ImageManipulator with the correct crop rect", () => {
  it("400×400 image at default position → full-image crop rect passed to manipulateAsync", async () => {
    // 400×400, CROP_SIZE=320 → minScale=0.8
    // computeCropRect(400, 400, 0.8, 0, 0, 320) = { originX:0, originY:0, width:400, height:400 }
    const onConfirm = jest.fn();

    const { getByText } = render(
      <CropModal
        {...BASE_PROPS}
        imageWidth={400}
        imageHeight={400}
        onConfirm={onConfirm}
      />
    );
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Use Photo"));
    });
    await flush();

    expect(mockManipulateAsync).toHaveBeenCalledTimes(1);

    const [uri, actions, options] = mockManipulateAsync.mock.calls[0];
    expect(uri).toBe("file:///test/photo.jpg");
    expect(actions[0].crop).toEqual({ originX: 0, originY: 0, width: 400, height: 400 });
    expect(actions[1]).toEqual({ resize: { width: 400, height: 400 } });
    expect(options.compress).toBe(0.7);
    expect(options.base64).toBe(true);
  });

  it("landscape 500×320 image → strips columns from both sides", async () => {
    // 500×320, minScale = max(320/500, 320/320) = 1
    // computeCropRect(500, 320, 1, 0, 0, 320) = { originX:90, originY:0, width:320, height:320 }
    const onConfirm = jest.fn();

    const { getByText } = render(
      <CropModal
        {...BASE_PROPS}
        imageWidth={500}
        imageHeight={320}
        onConfirm={onConfirm}
      />
    );
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Use Photo"));
    });
    await flush();

    const [, actions] = mockManipulateAsync.mock.calls[0];
    expect(actions[0].crop).toEqual({ originX: 90, originY: 0, width: 320, height: 320 });
  });

  it("onConfirm receives uri, base64, and mimeType from manipulateAsync result", async () => {
    const onConfirm = jest.fn();
    mockManipulateAsync.mockResolvedValueOnce({
      uri: "file:///cropped-result.jpg",
      base64: "base64data==",
    });

    const { getByText } = render(
      <CropModal {...BASE_PROPS} onConfirm={onConfirm} />
    );
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Use Photo"));
    });
    await flush();

    expect(onConfirm).toHaveBeenCalledWith({
      uri: "file:///cropped-result.jpg",
      base64: "base64data==",
      mimeType: "image/jpeg",
    });
  });

  it("does NOT call onConfirm when manipulateAsync throws", async () => {
    const onConfirm = jest.fn();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockManipulateAsync.mockRejectedValueOnce(new Error("disk full"));

    const { getByText } = render(
      <CropModal {...BASE_PROPS} onConfirm={onConfirm} />
    );
    await flush();

    await act(async () => {
      fireEvent.press(getByText("Use Photo"));
    });
    await flush();

    expect(onConfirm).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
