/**
 * Regression test: sub-score ring stagger animation in [id].tsx.
 *
 * The screen delegates stagger logic to `hooks/useCardStagger`. When
 * `cardsVisible` flips to true the hook schedules a setTimeout for each card
 * index i (firing at i * 100 ms), setting that card's animated flag to true.
 *
 * Tests here exercise the real exported hook (not a copy) so regressions in
 * the production implementation are caught directly.
 *
 * Note: effects register their setTimeouts asynchronously, so we always flush
 * effects in one act() call and advance timers in a separate one.
 */

import { renderHook, act } from "@testing-library/react-native";
import { useCardStagger } from "@/hooks/useCardStagger";

// ─── Constants mirroring [id].tsx ────────────────────────────────────────────

const SCORE_KEYS = [
  "technique",
  "power",
  "balance",
  "consistency",
  "mobility",
  "speed",
] as const;

const COUNT = SCORE_KEYS.length; // 6

// ─── Helper ───────────────────────────────────────────────────────────────────

async function triggerVisible(
  rerender: (props: { visible: boolean }) => void,
): Promise<void> {
  await act(async () => {
    rerender({ visible: true });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useCardStagger — sub-score ring stagger animation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("all entries start as false before cardsVisible becomes true", () => {
    const { result } = renderHook(() => useCardStagger(false, COUNT));
    expect(result.current).toEqual(Array(COUNT).fill(false));
  });

  it("does not fire any timeouts when cardsVisible remains false", async () => {
    const { result } = renderHook(() => useCardStagger(false, COUNT));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current).toEqual(Array(COUNT).fill(false));
  });

  it("all 6 entries are true after 500 ms (the final stagger step)", async () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useCardStagger(visible, COUNT),
      { initialProps: { visible: false } },
    );

    // Flush effects so setTimeouts are registered before advancing the clock.
    await triggerVisible(rerender);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));
  });

  it("stagger fires each card 100 ms apart from the previous one", async () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useCardStagger(visible, COUNT),
      { initialProps: { visible: false } },
    );

    // Register all six setTimeouts (card i fires at i * 100 ms).
    await triggerVisible(rerender);

    // Advance to midpoints between consecutive fire times so exactly one card
    // becomes animated per step:
    //   Step 0 —  50ms total  (past 0ms,   before 100ms): only card 0 true
    //   Step 1 — 150ms total  (past 100ms, before 200ms): cards 0–1 true
    //   Step 2 — 250ms total  (past 200ms, before 300ms): cards 0–2 true
    //   …
    for (let i = 0; i < COUNT; i++) {
      const advance = i === 0 ? 50 : 100;
      await act(async () => {
        jest.advanceTimersByTime(advance);
      });

      // Cards 0 … i must now be animated.
      for (let j = 0; j <= i; j++) {
        expect(result.current[j]).toBe(true);
      }
      // Cards i+1 … end must still be false.
      for (let j = i + 1; j < COUNT; j++) {
        expect(result.current[j]).toBe(false);
      }
    }
  });

  it("does not reset when cardsVisible toggles back to false after completion", async () => {
    const { result, rerender } = renderHook(
      ({ visible }: { visible: boolean }) => useCardStagger(visible, COUNT),
      { initialProps: { visible: false } },
    );

    // Run stagger to completion.
    await triggerVisible(rerender);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toEqual(Array(COUNT).fill(true));

    // Flip back to false; the effect returns early so no new timeouts fire.
    await act(async () => {
      rerender({ visible: false });
    });

    // Already-animated state must be preserved (no reset).
    expect(result.current).toEqual(Array(COUNT).fill(true));
  });
});
