/**
 * Tests that sport changes propagate to AI Coach suggestion chips.
 *
 * This file exercises the reactive loading logic that lives in
 * artifacts/lense-mobile/app/(tabs)/chat.tsx without rendering the full
 * React Native component tree.
 *
 * Key invariants under test (mirroring the actual component logic):
 *
 *   1. After the initial load completes, a sport change on the profile triggers
 *      loadSuggestions so the chips reflect the new sport.
 *   2. The guard `if (!initialLoadDone.current) return` prevents
 *      loadSuggestions from firing before the first history fetch —
 *      avoiding a double-load on mount.
 *   3. Two successive sport changes each produce a fresh suggestions fetch,
 *      and the final state matches the last call's response.
 *   4. A sport change to the same value as before does not result in an
 *      extra fetch (React's useEffect deduplication guarantee).
 *
 * The logic below is a faithful extraction of the relevant state machine
 * from chat.tsx:
 *
 *   const loadSuggestions = useCallback(async () => {
 *     const { suggestions } = await chatApi.suggestions();
 *     setSuggestions(suggestions);
 *   }, [canChat]);
 *
 *   useEffect(() => {
 *     if (!initialLoadDone.current) return;
 *     loadSuggestions();
 *   }, [profileSport, profileLevel, loadSuggestions]);
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── minimal state machine mirroring chat.tsx ──────────────────────────────────

interface SuggestionsResponse {
  suggestions: string[];
  hasCompletedAnalyses: boolean;
}

interface ChatScreenState {
  suggestions: string[];
  hasCompletedAnalyses: boolean;
  initialLoadDone: boolean;
  sport: string | undefined;
  level: string | undefined;
}

/**
 * Creates a self-contained simulation of the sport-change reactive logic from
 * chat.tsx. Returns helpers that reproduce:
 *
 *   - `doInitialLoad()` — mirrors the useFocusEffect which calls loadHistory
 *     (and internally calls chatApi.suggestions()) then sets initialLoadDone.
 *   - `onProfileChange(sport, level)` — mirrors the useEffect that fires when
 *     profileSport / profileLevel change; calls loadSuggestions only after
 *     initial load is done, and only when the values actually changed.
 */
function makeChatSportMachine(
  // Typed as `any` so vi.fn() (which has a broad mock type) is compatible.
  // The internal logic still uses SuggestionsResponse for safe access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchSuggestions: any,
) {
  const state: ChatScreenState = {
    suggestions: [],
    hasCompletedAnalyses: false,
    initialLoadDone: false,
    sport: undefined,
    level: undefined,
  };

  async function loadSuggestions() {
    const res = await fetchSuggestions();
    state.suggestions = res.suggestions;
    state.hasCompletedAnalyses = res.hasCompletedAnalyses;
  }

  async function doInitialLoad() {
    await loadSuggestions();
    state.initialLoadDone = true;
  }

  // Mirrors the useEffect([profileSport, profileLevel, loadSuggestions]) body.
  // React only re-runs when the dep values change, so we track lastSport/level.
  async function onProfileChange(newSport: string | undefined, newLevel: string | undefined) {
    const changed = newSport !== state.sport || newLevel !== state.level;
    if (!changed) return; // React skips re-run when deps are identical
    state.sport = newSport;
    state.level = newLevel;
    if (!state.initialLoadDone) return; // guard from chat.tsx
    await loadSuggestions();
  }

  return { state, doInitialLoad, onProfileChange };
}

// ── state machine that also tracks goals ─────────────────────────────────────

interface ChatScreenStateWithGoals extends ChatScreenState {
  goals: string[] | undefined;
}

/**
 * Extended version of makeChatSportMachine that also observes goals changes.
 *
 * Mirrors a hypothetical useEffect([profileSport, profileLevel, profileGoals,
 * loadSuggestions]) — adding goals as a dep means any change to goals alone
 * is enough to trigger a fresh suggestions fetch.
 */
function makeChatGoalsMachine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchSuggestions: any,
) {
  const state: ChatScreenStateWithGoals = {
    suggestions: [],
    hasCompletedAnalyses: false,
    initialLoadDone: false,
    sport: undefined,
    level: undefined,
    goals: undefined,
  };

  async function loadSuggestions() {
    const res: SuggestionsResponse = await fetchSuggestions();
    state.suggestions = res.suggestions;
    state.hasCompletedAnalyses = res.hasCompletedAnalyses;
  }

  async function doInitialLoad() {
    await loadSuggestions();
    state.initialLoadDone = true;
  }

  /**
   * Mirrors useEffect([profileSport, profileLevel, profileGoals, loadSuggestions]).
   * A change to any of the three profile values re-triggers suggestion loading.
   */
  async function onProfileChange(
    newSport: string | undefined,
    newLevel: string | undefined,
    newGoals: string[] | undefined,
  ) {
    const goalsKey = JSON.stringify(newGoals);
    const prevGoalsKey = JSON.stringify(state.goals);
    const changed =
      newSport !== state.sport ||
      newLevel !== state.level ||
      goalsKey !== prevGoalsKey;
    if (!changed) return;
    state.sport = newSport;
    state.level = newLevel;
    state.goals = newGoals;
    if (!state.initialLoadDone) return;
    await loadSuggestions();
  }

  return { state, doInitialLoad, onProfileChange };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe("chat screen — sport change propagates to suggestion chips", () => {
  let fetchSuggestions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSuggestions = vi.fn();
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it("re-fetches suggestions when profile sport changes after initial load", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({
        suggestions: ["Improve your running cadence", "Core drills for runners"],
        hasCompletedAnalyses: true,
      })
      .mockResolvedValueOnce({
        suggestions: ["Freestyle stroke drill for swimming", "Breathing technique for swimming"],
        hasCompletedAnalyses: true,
      });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    // Initial load — populates suggestions for the first sport
    await doInitialLoad();
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(state.suggestions[0]).toContain("running");

    // User changes their sport to swimming in profile settings then returns to Coach tab
    await onProfileChange("swimming", "intermediate");

    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    expect(state.suggestions[0]).toContain("swimming");
    // Old running suggestions are gone
    expect(state.suggestions.every(s => !s.includes("running"))).toBe(true);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it("does NOT call loadSuggestions before the initial load completes", async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: ["some tip"],
      hasCompletedAnalyses: false,
    });

    const { state, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    // Sport change fires before doInitialLoad has been called
    await onProfileChange("basketball", "beginner");

    // Guard must prevent the fetch
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(state.suggestions).toHaveLength(0);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it("tracks successive sport changes and always uses the latest API response", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({ suggestions: ["Cycling power drill"],        hasCompletedAnalyses: true })
      .mockResolvedValueOnce({ suggestions: ["Basketball dribbling drill"], hasCompletedAnalyses: true })
      .mockResolvedValueOnce({ suggestions: ["Yoga flexibility drill"],     hasCompletedAnalyses: true });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    await doInitialLoad(); // call 1 → cycling
    expect(state.suggestions[0]).toContain("Cycling");

    await onProfileChange("basketball", "intermediate"); // call 2 → basketball
    expect(state.suggestions[0]).toContain("Basketball");

    await onProfileChange("yoga", "beginner"); // call 3 → yoga
    expect(state.suggestions[0]).toContain("Yoga");

    expect(fetchSuggestions).toHaveBeenCalledTimes(3);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it("does NOT issue a redundant fetch when the sport value is unchanged", async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: ["Tennis serve drill"],
      hasCompletedAnalyses: true,
    });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    await doInitialLoad();
    // Simulate what React stores after the first profile read
    state.sport = "tennis";
    state.level = "intermediate";

    // Same values again — no change
    await onProfileChange("tennis", "intermediate");

    // Only the initial load fetch; no second call
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it("updates hasCompletedAnalyses together with suggestions on sport change", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({ suggestions: ["tip A"], hasCompletedAnalyses: false })
      .mockResolvedValueOnce({ suggestions: ["tip B"], hasCompletedAnalyses: true });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    await doInitialLoad();
    expect(state.hasCompletedAnalyses).toBe(false);

    await onProfileChange("football", "advanced");
    expect(state.hasCompletedAnalyses).toBe(true);
    expect(state.suggestions[0]).toBe("tip B");
  });

  // ── Test 6 ────────────────────────────────────────────────────────────────

  it("re-fetches suggestions when only the level changes (sport stays the same)", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({
        suggestions: ["Focus on basic form", "Beginner drills for running"],
        hasCompletedAnalyses: true,
      })
      .mockResolvedValueOnce({
        suggestions: ["Advanced interval training", "Lactate threshold work"],
        hasCompletedAnalyses: true,
      });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    // Initial load — suggestions for a beginner runner
    await doInitialLoad();
    state.sport = "running";
    state.level = "beginner";
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(state.suggestions[0]).toContain("basic form");

    // Athlete upgrades their level to advanced — sport is unchanged
    await onProfileChange("running", "advanced");

    // A second fetch must fire because the level dep changed
    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    // Suggestions now reflect the advanced level
    expect(state.suggestions[0]).toContain("Advanced");
    // Beginner suggestions are gone
    expect(state.suggestions.every(s => !s.toLowerCase().includes("beginner"))).toBe(true);
  });

  // ── Test 7 ────────────────────────────────────────────────────────────────

  it("does NOT re-fetch when both sport and level are unchanged", async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: ["Keep up the great work"],
      hasCompletedAnalyses: true,
    });

    const { state, doInitialLoad, onProfileChange } = makeChatSportMachine(fetchSuggestions);

    await doInitialLoad();
    state.sport = "swimming";
    state.level = "advanced";

    // Simulate profile re-read returning identical values
    await onProfileChange("swimming", "advanced");

    // No second call — neither dep changed
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
  });
});

// ── Goals change tests ────────────────────────────────────────────────────────

describe("chat screen — goals change propagates to suggestion chips", () => {
  let fetchSuggestions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSuggestions = vi.fn();
  });

  // ── Test 1 ────────────────────────────────────────────────────────────────

  it("re-fetches suggestions when only goals change after initial load", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({
        suggestions: ["Improve your running cadence", "Core drills"],
        hasCompletedAnalyses: true,
      })
      .mockResolvedValueOnce({
        suggestions: ["Increase weekly mileage", "Hill repeat training"],
        hasCompletedAnalyses: true,
      });

    const { state, doInitialLoad, onProfileChange } = makeChatGoalsMachine(fetchSuggestions);

    await doInitialLoad();
    state.sport = "running";
    state.level = "intermediate";
    state.goals = [];
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);

    // Athlete adds a new goal — sport and level stay the same
    await onProfileChange("running", "intermediate", ["run a marathon"]);

    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    expect(state.suggestions[0]).toContain("mileage");
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────

  it("does NOT re-fetch when goals, sport, and level are all unchanged", async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: ["Stay consistent"],
      hasCompletedAnalyses: true,
    });

    const { state, doInitialLoad, onProfileChange } = makeChatGoalsMachine(fetchSuggestions);

    await doInitialLoad();
    state.sport = "cycling";
    state.level = "beginner";
    state.goals = ["lose weight"];

    // Same values again
    await onProfileChange("cycling", "beginner", ["lose weight"]);

    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────

  it("re-fetches when one goal is replaced with another", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({
        suggestions: ["tip for old goal"],
        hasCompletedAnalyses: true,
      })
      .mockResolvedValueOnce({
        suggestions: ["tip for new goal"],
        hasCompletedAnalyses: true,
      });

    const { state, doInitialLoad, onProfileChange } = makeChatGoalsMachine(fetchSuggestions);

    await doInitialLoad();
    state.sport = "swimming";
    state.level = "advanced";
    state.goals = ["build endurance"];

    // Swap the goal — sport and level unchanged
    await onProfileChange("swimming", "advanced", ["improve flip turns"]);

    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    expect(state.suggestions[0]).toContain("new goal");
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────

  it("does NOT call loadSuggestions before the initial load completes even when goals change", async () => {
    fetchSuggestions.mockResolvedValue({
      suggestions: ["some tip"],
      hasCompletedAnalyses: false,
    });

    const { state, onProfileChange } = makeChatGoalsMachine(fetchSuggestions);

    // Goals change before doInitialLoad has been called
    await onProfileChange("tennis", "intermediate", ["qualify for regionals"]);

    // Guard must prevent the fetch
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(state.suggestions).toHaveLength(0);
  });

  // ── Test 5 ────────────────────────────────────────────────────────────────

  it("re-fetches when goals are cleared (athlete removes all goals)", async () => {
    fetchSuggestions
      .mockResolvedValueOnce({
        suggestions: ["tips with a goal"],
        hasCompletedAnalyses: true,
      })
      .mockResolvedValueOnce({
        suggestions: ["generic tips, no goal"],
        hasCompletedAnalyses: true,
      });

    const { state, doInitialLoad, onProfileChange } = makeChatGoalsMachine(fetchSuggestions);

    await doInitialLoad();
    state.sport = "basketball";
    state.level = "intermediate";
    state.goals = ["make varsity team"];

    // Athlete clears all goals
    await onProfileChange("basketball", "intermediate", []);

    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    expect(state.suggestions[0]).toContain("generic");
  });
});
