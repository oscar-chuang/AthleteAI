import { renderHook, act } from "@testing-library/react-native";
import { useSharePreview } from "@/hooks/useSharePreview";

const mockCaptureRef = jest.fn();
jest.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

const FAKE_URI = "file:///tmp/share-card.png";

describe("useSharePreview — share modal state transitions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockCaptureRef.mockResolvedValue(FAKE_URI);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it("handleShare opens the modal (showSharePreview becomes true)", () => {
    const { result } = renderHook(() => useSharePreview());

    expect(result.current.showSharePreview).toBe(false);

    act(() => {
      result.current.handleShare();
    });

    expect(result.current.showSharePreview).toBe(true);
  });

  it("handleCancelShare closes the modal without calling captureRef", () => {
    const { result } = renderHook(() => useSharePreview());

    act(() => {
      result.current.handleShare();
    });
    expect(result.current.showSharePreview).toBe(true);

    act(() => {
      result.current.handleCancelShare();
    });

    expect(result.current.showSharePreview).toBe(false);
    expect(mockCaptureRef).not.toHaveBeenCalled();
  });

  it("handleDoShare calls captureRef then shareAsync and closes the modal", async () => {
    const { result } = renderHook(() => useSharePreview());

    act(() => {
      result.current.handleShare();
    });
    expect(result.current.showSharePreview).toBe(true);

    const fakeRef = { current: {} } as React.RefObject<import("react-native").View | null>;

    await act(async () => {
      await result.current.handleDoShare(fakeRef);
    });

    expect(mockCaptureRef).toHaveBeenCalledWith(fakeRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });
    expect(mockShareAsync).toHaveBeenCalledWith(FAKE_URI, {
      mimeType: "image/png",
      dialogTitle: "Share your session",
    });
    expect(result.current.showSharePreview).toBe(false);
  });
});
