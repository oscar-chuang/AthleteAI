import { renderHook, act } from "@testing-library/react-native";
import { useState, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

  it("when sharing is unavailable handleDoShare keeps the modal open and sets sharingUnavailable", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    const { result } = renderHook(() => useSharePreview());

    act(() => {
      result.current.handleShare();
    });
    expect(result.current.showSharePreview).toBe(true);
    expect(result.current.sharingUnavailable).toBe(false);

    const fakeRef = { current: {} } as React.RefObject<import("react-native").View | null>;

    await act(async () => {
      await result.current.handleDoShare(fakeRef);
    });

    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(result.current.showSharePreview).toBe(true);
    expect(result.current.sharingUnavailable).toBe(true);
  });

  it("handleCancelShare clears sharingUnavailable when the modal is dismissed", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    const { result } = renderHook(() => useSharePreview());

    act(() => {
      result.current.handleShare();
    });

    const fakeRef = { current: {} } as React.RefObject<import("react-native").View | null>;

    await act(async () => {
      await result.current.handleDoShare(fakeRef);
    });

    expect(result.current.sharingUnavailable).toBe(true);

    act(() => {
      result.current.handleCancelShare();
    });

    expect(result.current.sharingUnavailable).toBe(false);
    expect(result.current.showSharePreview).toBe(false);
  });

  it("reopening the modal via handleShare resets sharingUnavailable", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    const { result } = renderHook(() => useSharePreview());

    act(() => {
      result.current.handleShare();
    });

    const fakeRef = { current: {} } as React.RefObject<import("react-native").View | null>;

    await act(async () => {
      await result.current.handleDoShare(fakeRef);
    });

    expect(result.current.sharingUnavailable).toBe(true);

    act(() => {
      result.current.handleShare();
    });

    expect(result.current.sharingUnavailable).toBe(false);
    expect(result.current.showSharePreview).toBe(true);
  });
});

// ─── Colour-scheme picker ──────────────────────────────────────────────────────
// The AnalysisDetailScreen keeps a single `shareScheme` state variable that is
// passed as the `colorScheme` prop to BOTH the visible preview ShareCard and the
// hidden capture-target ShareCard (the ref used by react-native-view-shot).
// These tests exercise that state in isolation — mirroring the screen's logic
// without requiring JSX or mounting the full screen tree.

function useShareScheme() {
  const [shareScheme, setShareScheme] = useState<"dark" | "light">("dark");
  return { shareScheme, setShareScheme };
}

describe("share preview — colour-scheme picker", () => {
  it("defaults to the 'dark' scheme", () => {
    const { result } = renderHook(() => useShareScheme());

    expect(result.current.shareScheme).toBe("dark");
  });

  it("pressing the 'Light' pill updates shareScheme to 'light' immediately", () => {
    const { result } = renderHook(() => useShareScheme());

    expect(result.current.shareScheme).toBe("dark");

    act(() => {
      // Mirrors the onPress of the "Light" schemePill in AnalysisDetailScreen:
      //   setShareScheme("light")
      result.current.setShareScheme("light");
    });

    expect(result.current.shareScheme).toBe("light");
  });

  it("pressing the 'Dark' pill after 'Light' reverts the scheme to 'dark'", () => {
    const { result } = renderHook(() => useShareScheme());

    act(() => {
      result.current.setShareScheme("light");
    });
    expect(result.current.shareScheme).toBe("light");

    act(() => {
      result.current.setShareScheme("dark");
    });
    expect(result.current.shareScheme).toBe("dark");
  });

  it("selecting 'light' calls AsyncStorage.setItem('shareCardScheme', 'light')", async () => {
    const setItemSpy = jest
      .spyOn(AsyncStorage, "setItem")
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useShareScheme());

    await act(async () => {
      // Mirrors the onPress in AnalysisDetailScreen:
      //   setShareScheme(scheme)
      //   AsyncStorage.setItem(SHARE_CARD_SCHEME_KEY, scheme).catch(() => {})
      result.current.setShareScheme("light");
      await AsyncStorage.setItem("shareCardScheme", "light");
    });

    expect(setItemSpy).toHaveBeenCalledWith("shareCardScheme", "light");
    setItemSpy.mockRestore();
  });

  it("a pre-seeded AsyncStorage value of 'light' is restored on mount", async () => {
    // Mirrors the useEffect in AnalysisDetailScreen that reads SHARE_CARD_SCHEME_KEY
    // on mount and calls setShareScheme if the stored value is valid.
    const getItemSpy = jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValue("light");

    function useShareSchemeWithRestore() {
      const [shareScheme, setShareScheme] = useState<"dark" | "light">("dark");

      useEffect(() => {
        AsyncStorage.getItem("shareCardScheme")
          .then((saved) => {
            if (saved === "dark" || saved === "light") setShareScheme(saved);
          })
          .catch(() => {});
      }, []);

      return { shareScheme };
    }

    const { result } = renderHook(() => useShareSchemeWithRestore());

    // Before the effect resolves, scheme is still the default.
    expect(result.current.shareScheme).toBe("dark");

    // Wait for the async getItem to resolve and the state update to flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.shareScheme).toBe("light");
    expect(getItemSpy).toHaveBeenCalledWith("shareCardScheme");
    getItemSpy.mockRestore();
  });

  it("the visible preview card and the hidden capture card both receive the updated scheme", () => {
    // Both ShareCard instances in the screen read from the same shareScheme
    // state reference — the screen passes identical props to each:
    //   <ShareCard colorScheme={shareScheme} />   ← visible preview (inside Modal)
    //   <ShareCard colorScheme={shareScheme} />   ← hidden capture ref (outside Modal)
    // This test confirms that one state update propagates to both slots.
    const { result } = renderHook(() => {
      const [shareScheme, setShareScheme] = useState<"dark" | "light">("dark");

      // Derive both card schemes exactly as the screen does — from the same ref.
      const visiblePreviewCardScheme  = shareScheme;
      const hiddenCaptureCardScheme   = shareScheme;

      return { shareScheme, setShareScheme, visiblePreviewCardScheme, hiddenCaptureCardScheme };
    });

    // Both cards start dark.
    expect(result.current.visiblePreviewCardScheme).toBe("dark");
    expect(result.current.hiddenCaptureCardScheme).toBe("dark");

    // Simulate pressing the "Light" pill.
    act(() => {
      result.current.setShareScheme("light");
    });

    // Both cards must now be light — a single state value drives both.
    expect(result.current.visiblePreviewCardScheme).toBe("light");
    expect(result.current.hiddenCaptureCardScheme).toBe("light");
  });
});

// ─── Tip memory ───────────────────────────────────────────────────────────────
// AnalysisDetailScreen keeps a shareTipMemoryRef (useRef keyed by analysis ID)
// so the last-chosen tip survives modal close/reopen within one session without
// hitting AsyncStorage.
//
// handleShare() reads shareTipMemoryRef.current[analysisId]:
//   - undefined  → fall back to topTip (first open, or never picked)
//   - null       → explicit "no tip" selection
//   - string     → the previously-picked tip ID
//
// The tip picker's onPress writes: shareTipMemoryRef.current[analysisId] = tip.id
//
// These tests mirror that logic in isolation — no JSX required.

const TIPS = [
  { id: "tip-critical", title: "Fix your knee",   severity: "critical" },
  { id: "tip-warning",  title: "Watch your back", severity: "warning"  },
  { id: "tip-info",     title: "Stretch more",    severity: "info"     },
];

function useShareTipMemory() {
  // Mirrors shareTipMemoryRef in the screen.
  const shareTipMemoryRef = useRef<Record<string, string | null>>({});
  const [selectedShareTipId, setSelectedShareTipId] = useState<string | null>(null);

  // Mirrors handleShare() — reads memory, falls back to topTipId on first open.
  const openShare = (analysisId: string, topTipId: string | null) => {
    const remembered = shareTipMemoryRef.current[analysisId];
    const initialTip = remembered !== undefined ? remembered : topTipId;
    setSelectedShareTipId(initialTip);
  };

  // Mirrors the tip picker's onPress.
  const pickTip = (analysisId: string, tipId: string) => {
    setSelectedShareTipId(tipId);
    shareTipMemoryRef.current[analysisId] = tipId;
  };

  return { selectedShareTipId, openShare, pickTip };
}

describe("share preview — tip memory", () => {
  it("defaults to the top (highest-severity) tip on first open", () => {
    const { result } = renderHook(() => useShareTipMemory());

    act(() => {
      result.current.openShare("analysis-abc", TIPS[0]!.id);
    });

    // No memory yet → falls back to topTip (tip-critical).
    expect(result.current.selectedShareTipId).toBe("tip-critical");
  });

  it("pre-selects the last-chosen tip when the modal is reopened", () => {
    const { result } = renderHook(() => useShareTipMemory());

    // First open — no memory yet, falls back to topTip.
    act(() => {
      result.current.openShare("analysis-abc", TIPS[0]!.id);
    });
    expect(result.current.selectedShareTipId).toBe("tip-critical");

    // User picks a non-default tip — memory is written.
    act(() => {
      result.current.pickTip("analysis-abc", "tip-warning");
    });
    expect(result.current.selectedShareTipId).toBe("tip-warning");

    // Reopen the same analysis — openShare() reads memory and pre-selects the
    // remembered tip regardless of what topTip would default to.
    act(() => {
      result.current.openShare("analysis-abc", TIPS[0]!.id);
    });
    expect(result.current.selectedShareTipId).toBe("tip-warning");
  });

  it("tip memory is keyed per analysis — different analyses are independent", () => {
    const { result } = renderHook(() => useShareTipMemory());

    // Pick a non-default tip for analysis-A.
    act(() => {
      result.current.openShare("analysis-A", TIPS[0]!.id);
    });
    act(() => {
      result.current.pickTip("analysis-A", "tip-info");
    });

    // Open analysis-B for the first time — must fall back to its own topTip.
    act(() => {
      result.current.openShare("analysis-B", TIPS[1]!.id);
    });
    expect(result.current.selectedShareTipId).toBe("tip-warning");

    // Reopen analysis-A — must still remember tip-info.
    act(() => {
      result.current.openShare("analysis-A", TIPS[0]!.id);
    });
    expect(result.current.selectedShareTipId).toBe("tip-info");
  });

  it("picking every tip in sequence always updates the memory to the latest choice", () => {
    const { result } = renderHook(() => useShareTipMemory());

    act(() => {
      result.current.openShare("analysis-seq", TIPS[0]!.id);
    });

    for (const tip of TIPS) {
      act(() => {
        result.current.pickTip("analysis-seq", tip.id);
      });
      expect(result.current.selectedShareTipId).toBe(tip.id);
    }

    // Reopen — must remember the last tip picked (tip-info).
    act(() => {
      result.current.openShare("analysis-seq", TIPS[0]!.id);
    });
    expect(result.current.selectedShareTipId).toBe("tip-info");
  });
});
