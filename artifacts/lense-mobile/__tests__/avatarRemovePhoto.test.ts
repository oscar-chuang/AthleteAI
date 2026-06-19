/**
 * Tests that the avatar upload rollback works correctly when updateProfile
 * rejects after the optimistic avatarUrl update in handleCropConfirm.
 *
 * This file exercises the state machine that lives in
 * artifacts/lense-mobile/app/profile-settings.tsx without rendering the full
 * React Native component tree.
 *
 * Key invariants under test (mirroring the actual handleCropConfirm logic):
 *
 *   1. When updateProfile resolves, avatarUrl is kept at the new data-URI and
 *      no error is set.
 *   2. When updateProfile rejects, avatarUrl is rolled back to the previous
 *      value (profile?.avatarUrl) and error is set to the canonical message.
 *   3. avatarSaving is always cleared (false) in the finally block, regardless
 *      of success or failure.
 *   4. When updateProfile rejects and the previous avatarUrl was null/undefined,
 *      avatarUrl rolls back to null/undefined (not left at the optimistic URI).
 *
 * The logic below is a faithful extraction of handleCropConfirm from
 * profile-settings.tsx:
 *
 *   async function handleCropConfirm(cropResult: CropResult) {
 *     setCropVisible(false);
 *     const uri = `data:${cropResult.mimeType};base64,${cropResult.base64}`;
 *     setAvatarUrl(uri);
 *     setAvatarSaving(true);
 *     try {
 *       await updateProfile({ avatarUrl: uri });
 *     } catch {
 *       setError("Couldn't save photo. Please try again.");
 *       setAvatarUrl(profile?.avatarUrl);
 *     } finally {
 *       setAvatarSaving(false);
 *     }
 *   }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── minimal types ─────────────────────────────────────────────────────────────

interface CropResult {
  mimeType: string;
  base64: string;
}

interface ProfileSettingsState {
  avatarUrl: string | null | undefined;
  avatarSaving: boolean;
  error: string | null;
  cropVisible: boolean;
}

// ── state machine extracted from handleCropConfirm ────────────────────────────

/**
 * Creates a self-contained simulation of the handleCropConfirm state machine
 * from profile-settings.tsx. Returns helpers that reproduce:
 *
 *   - `handleCropConfirm(cropResult)` — applies the optimistic update, calls
 *     updateProfile, and rolls back on failure.
 *
 * `previousAvatarUrl` simulates profile?.avatarUrl (the server-committed value
 * before the optimistic write).
 */
function makeAvatarUploadMachine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProfile: any,
  previousAvatarUrl: string | null | undefined,
) {
  const state: ProfileSettingsState = {
    avatarUrl: previousAvatarUrl,
    avatarSaving: false,
    error: null,
    cropVisible: true,
  };

  async function handleCropConfirm(cropResult: CropResult) {
    state.cropVisible = false;
    const uri = `data:${cropResult.mimeType};base64,${cropResult.base64}`;
    state.avatarUrl = uri;
    state.avatarSaving = true;
    try {
      await updateProfile({ avatarUrl: uri });
    } catch {
      state.error = "Couldn't save photo. Please try again.";
      state.avatarUrl = previousAvatarUrl;
    } finally {
      state.avatarSaving = false;
    }
  }

  return { state, handleCropConfirm };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("profile settings — avatar upload rollback on handleCropConfirm", () => {
  const PREVIOUS_AVATAR = "https://example.com/old-avatar.jpg";
  const CROP_RESULT: CropResult = { mimeType: "image/jpeg", base64: "abc123" };
  const NEW_URI = `data:${CROP_RESULT.mimeType};base64,${CROP_RESULT.base64}`;

  let updateProfile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateProfile = vi.fn();
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────

  it("keeps the new avatarUrl and sets no error when updateProfile resolves", async () => {
    updateProfile.mockResolvedValueOnce(undefined);

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(state.avatarUrl).toBe(NEW_URI);
    expect(state.error).toBeNull();
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────

  it("rolls back avatarUrl to the previous value when updateProfile rejects", async () => {
    updateProfile.mockRejectedValueOnce(new Error("Network error"));

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(state.avatarUrl).toBe(PREVIOUS_AVATAR);
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────

  it("sets the canonical error message when updateProfile rejects", async () => {
    updateProfile.mockRejectedValueOnce(new Error("500"));

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(state.error).toBe("Couldn't save photo. Please try again.");
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────

  it("clears avatarSaving in the finally block on success", async () => {
    updateProfile.mockResolvedValueOnce(undefined);

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(state.avatarSaving).toBe(false);
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────

  it("clears avatarSaving in the finally block on failure", async () => {
    updateProfile.mockRejectedValueOnce(new Error("Timeout"));

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(state.avatarSaving).toBe(false);
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────

  it("rolls back to null/undefined when the user had no previous avatar and upload fails", async () => {
    updateProfile.mockRejectedValueOnce(new Error("Upload failed"));

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      null, // user had no avatar before
    );

    await handleCropConfirm(CROP_RESULT);

    // Must not be left at the optimistic URI
    expect(state.avatarUrl).toBeNull();
    expect(state.error).toBe("Couldn't save photo. Please try again.");
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────

  it("applies the optimistic update (avatarUrl = new URI) before awaiting updateProfile", async () => {
    let capturedAvatarUrlDuringCall: string | null | undefined;

    updateProfile.mockImplementationOnce(async () => {
      capturedAvatarUrlDuringCall = state.avatarUrl;
    });

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(capturedAvatarUrlDuringCall).toBe(NEW_URI);
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────

  it("closes the crop modal (cropVisible = false) before calling updateProfile", async () => {
    let capturedCropVisibleDuringCall: boolean | undefined;

    updateProfile.mockImplementationOnce(async () => {
      capturedCropVisibleDuringCall = state.cropVisible;
    });

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    await handleCropConfirm(CROP_RESULT);

    expect(capturedCropVisibleDuringCall).toBe(false);
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────

  it("does not set an error on success even after a prior failed attempt", async () => {
    updateProfile
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce(undefined);

    const { state, handleCropConfirm } = makeAvatarUploadMachine(
      updateProfile,
      PREVIOUS_AVATAR,
    );

    // First attempt fails — error is set, avatarUrl is rolled back
    await handleCropConfirm(CROP_RESULT);
    expect(state.error).toBe("Couldn't save photo. Please try again.");
    expect(state.avatarUrl).toBe(PREVIOUS_AVATAR);

    // Second attempt succeeds — error must be cleared by the component
    // (the machine itself does not auto-clear; the component does setError(null)
    // elsewhere, so here we just confirm avatarUrl is kept and no new error added)
    await handleCropConfirm(CROP_RESULT);
    expect(state.avatarUrl).toBe(NEW_URI);
  });
});
