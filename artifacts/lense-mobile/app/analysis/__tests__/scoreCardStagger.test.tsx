/**
 * Regression test: sub-score ring stagger animation in [id].tsx.
 *
 * The screen delegates stagger logic to `hooks/useCardStagger`. The hook
 * uses Reanimated withDelay + withSequence on the UI thread to schedule
 * each card's boolean flag becoming true.
 *
 * Under jest-expo's Reanimated mock, all animations execute synchronously
 * (withDelay does not honour its delay argument, withTiming fires the
 * callback immediately). So the observable behaviour in tests is:
 *   - All flags are false before cardsVisible becomes true
 *   - All flags become true synchronously when cardsVisible becomes true
 *
 * Tests here exercise the real exported hook (not a copy) so regressions in
 * the production implementation are caught directly.
 */

import { renderHook, act } from "@testing-library/react-native";
import { useCardStagger } from "@/hooks/useCardStagger";

const SCORE_KEYS = [
  "technique",
  "power",
  "balance",
  "consistency",
  "mobility",
  "speed",
] as const;

const COUNT = SCORE_KEYS.length; // 6

describe("useCardStagger — sub-score ring stagger animation", () => {
  it("all entries start as false before cardsVisible becomes true", () => {
    const { result } = renderHook(() => useCardStagger(false, COUNT));
    expect(result.current).toEqual(Array(COUNT).fill(false));
  });

  it("entries remain false while cardsVisible stays false", async () => {
    const { result } = renderHook(() => useCardStagger(false, COUNT));

    await act(async () => {});

    expect(result.current).toEqual(Array(COUNT).fill(false));
  });

  it("all entries become true when cardsVisible becomes true", async () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useCardStagger(visible, COUNT),
      { initialProps: { visible: false } },
    );

    await act(async () => {
      rerender({ visible: true });
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));
  });

  it("instant=true starts all entries as true immediately", () => {
    const { result } = renderHook(() => useCardStagger(false, COUNT, true));
    expect(result.current).toEqual(Array(COUNT).fill(true));
  });

  it("instant=true path sets all entries true even when not visible", async () => {
    const { result, rerender } = renderHook(
      ({ instant }: { instant: boolean }) => useCardStagger(false, COUNT, instant),
      { initialProps: { instant: false } },
    );

    await act(async () => {
      rerender({ instant: true });
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));
  });

  it("does not reset when cardsVisible toggles back to false after completion", async () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useCardStagger(visible, COUNT),
      { initialProps: { visible: false } },
    );

    await act(async () => {
      rerender({ visible: true });
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));

    await act(async () => {
      rerender({ visible: false });
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));
  });
});
