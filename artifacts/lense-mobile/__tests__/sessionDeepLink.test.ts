import { describe, it, expect, vi } from "vitest";
import {
  buildSessionDeepLink,
  buildSessionShareMessage,
  buildSessionSharePayload,
  SESSION_DEEP_LINK_SCHEME,
} from "../utils/shareUtils";

const ANALYSIS_ID = "abc-123";
const SPORT       = "running";
const IMAGE_URI   = "file:///tmp/share-card.png";
const EXPECTED_DEEP_LINK = `athleteai://analysis/${ANALYSIS_ID}`;

// ── Deep link construction ────────────────────────────────────────────────────

describe("buildSessionDeepLink", () => {
  it("produces the athleteai:// scheme URL for a given analysis ID", () => {
    expect(buildSessionDeepLink(ANALYSIS_ID)).toBe(EXPECTED_DEEP_LINK);
  });

  it("uses the exported SESSION_DEEP_LINK_SCHEME constant as its prefix", () => {
    expect(buildSessionDeepLink(ANALYSIS_ID).startsWith(SESSION_DEEP_LINK_SCHEME)).toBe(true);
  });

  it("appends the analysis ID after the scheme path", () => {
    const link = buildSessionDeepLink("xyz-789");
    expect(link).toBe("athleteai://analysis/xyz-789");
  });

  it("works for UUIDs as analysis IDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(buildSessionDeepLink(uuid)).toBe(`athleteai://analysis/${uuid}`);
  });
});

// ── Share message construction ────────────────────────────────────────────────

describe("buildSessionShareMessage", () => {
  it("contains the deep link for the given analysis ID", () => {
    const msg = buildSessionShareMessage(ANALYSIS_ID, SPORT);
    expect(msg).toContain(EXPECTED_DEEP_LINK);
  });

  it("contains the sport name", () => {
    const msg = buildSessionShareMessage(ANALYSIS_ID, "cycling");
    expect(msg).toContain("cycling");
  });

  it("contains AthleteAI branding", () => {
    const msg = buildSessionShareMessage(ANALYSIS_ID, SPORT);
    expect(msg).toContain("AthleteAI");
  });

  it("places the deep link after the text body (not before)", () => {
    const msg = buildSessionShareMessage(ANALYSIS_ID, SPORT);
    const linkIndex = msg.indexOf(EXPECTED_DEEP_LINK);
    expect(linkIndex).toBeGreaterThan(0);
  });
});

// ── iOS share payload ─────────────────────────────────────────────────────────
//
// On iOS, Share.share() is called with { url, message }.
// `url` carries the image URI; `message` carries the text including the deep link.

describe("buildSessionSharePayload — iOS path (url field)", () => {
  it("sets url to the captured image URI", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.url).toBe(IMAGE_URI);
  });

  it("includes the deep link in the message field", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.message).toContain(EXPECTED_DEEP_LINK);
  });

  it("message field contains the exact athleteai:// scheme", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.message).toContain("athleteai://");
  });

  it("message field embeds the analysis ID", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.message).toContain(ANALYSIS_ID);
  });

  it("simulates Share.share called with iOS payload — link present in message", () => {
    const mockShare = vi.fn().mockResolvedValue({ action: "sharedAction" });

    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    mockShare({ url: payload.url, message: payload.message });

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(EXPECTED_DEEP_LINK),
      }),
    );
  });
});

// ── Android fallback share payload ────────────────────────────────────────────
//
// When expo-sharing is unavailable, Android falls back to Share.share({ message }).
// The message MUST contain the deep link so the recipient can open the session.

describe("buildSessionSharePayload — Android fallback (message field)", () => {
  it("message field alone contains the deep link for Android fallback", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.message).toContain(EXPECTED_DEEP_LINK);
  });

  it("message field starts with 'Check out' introductory text", () => {
    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    expect(payload.message.startsWith("Check out")).toBe(true);
  });

  it("simulates Share.share called with Android fallback — link present in message", () => {
    const mockShare = vi.fn().mockResolvedValue({ action: "sharedAction" });

    const payload = buildSessionSharePayload(ANALYSIS_ID, SPORT, IMAGE_URI);
    mockShare({ message: payload.message });

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(EXPECTED_DEEP_LINK),
      }),
    );
  });

  it("deep link is preserved regardless of the sport string", () => {
    for (const sport of ["tennis", "swimming", "football", "yoga"]) {
      const payload = buildSessionSharePayload(ANALYSIS_ID, sport, IMAGE_URI);
      expect(payload.message).toContain(EXPECTED_DEEP_LINK);
    }
  });
});
