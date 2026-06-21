import { describe, it, expect } from "vitest";
import { toTitleCase } from "@/utils/formatDisplay";
import { STATUS_LABEL } from "@/utils/sessionStatus";

function sessionCardLabel(sport: string, status: string): string {
  return [toTitleCase(sport), STATUS_LABEL[status] ?? status]
    .filter(Boolean)
    .join(" · ");
}

describe("home-screen session card — sport label is title-cased", () => {
  describe("complete sessions: sport appears alone (STATUS_LABEL['complete'] is empty)", () => {
    it("renders just 'Running' (no status suffix) for a complete running session", () => {
      expect(STATUS_LABEL["complete"]).toBe("");
      expect(sessionCardLabel("running", "complete")).toBe("Running");
    });

    it("renders just 'Swimming' for a complete swimming session", () => {
      expect(sessionCardLabel("swimming", "complete")).toBe("Swimming");
    });

    it("renders just 'Cycling' for a complete cycling session", () => {
      expect(sessionCardLabel("cycling", "complete")).toBe("Cycling");
    });

    it("renders just 'Basketball' for a complete basketball session", () => {
      expect(sessionCardLabel("basketball", "complete")).toBe("Basketball");
    });

    it("renders just 'Weightlifting' for a complete weightlifting session", () => {
      expect(sessionCardLabel("weightlifting", "complete")).toBe("Weightlifting");
    });

    it("renders just 'Yoga' for a complete yoga session", () => {
      expect(sessionCardLabel("yoga", "complete")).toBe("Yoga");
    });

    it("renders just 'Tennis' for a complete tennis session", () => {
      expect(sessionCardLabel("tennis", "complete")).toBe("Tennis");
    });

    it("renders just 'Soccer' for a complete soccer session", () => {
      expect(sessionCardLabel("soccer", "complete")).toBe("Soccer");
    });
  });

  describe("non-complete sessions: sport · status label", () => {
    it("shows 'Running · Queued' for pending status (production label: 'Queued')", () => {
      expect(STATUS_LABEL["pending"]).toBe("Queued");
      expect(sessionCardLabel("running", "pending")).toBe("Running · Queued");
    });

    it("shows 'Running · Analysing…' for processing status", () => {
      expect(STATUS_LABEL["processing"]).toBe("Analysing\u2026");
      expect(sessionCardLabel("running", "processing")).toBe("Running \u00b7 Analysing\u2026");
    });

    it("shows 'Running · Could not analyse' for failed status", () => {
      expect(STATUS_LABEL["failed"]).toBe("Could not analyse");
      expect(sessionCardLabel("running", "failed")).toBe("Running · Could not analyse");
    });

    it("shows 'Running · Uploading…' for uploading status", () => {
      expect(STATUS_LABEL["uploading"]).toBe("Uploading\u2026");
      expect(sessionCardLabel("running", "uploading")).toBe("Running \u00b7 Uploading\u2026");
    });
  });

  describe("raw DB value is never exposed as the sport portion", () => {
    it("sport portion does not start with a lowercase letter for complete sessions", () => {
      const rawSports = ["running", "swimming", "cycling", "tennis", "yoga", "boxing", "rowing"];
      for (const sport of rawSports) {
        const label = sessionCardLabel(sport, "complete");
        expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
      }
    });

    it("the raw lowercase sport is not present verbatim in the label", () => {
      const rawSports = ["running", "swimming", "cycling", "tennis", "yoga", "boxing"];
      for (const sport of rawSports) {
        const label = sessionCardLabel(sport, "complete");
        expect(label).not.toContain(sport);
      }
    });
  });

  describe("multi-word sports", () => {
    it("renders 'Weight Lifting' for sport='weight lifting' (complete)", () => {
      expect(sessionCardLabel("weight lifting", "complete")).toBe("Weight Lifting");
    });

    it("renders 'High Jump' for sport='high jump' (complete)", () => {
      expect(sessionCardLabel("high jump", "complete")).toBe("High Jump");
    });
  });
});

describe("home-screen badge — level label is title-cased", () => {
  it("renders 'Beginner' for level='beginner'", () => {
    expect(toTitleCase("beginner")).toBe("Beginner");
  });

  it("renders 'Intermediate' for level='intermediate'", () => {
    expect(toTitleCase("intermediate")).toBe("Intermediate");
  });

  it("renders 'Advanced' for level='advanced'", () => {
    expect(toTitleCase("advanced")).toBe("Advanced");
  });

  it("renders 'Elite' for level='elite'", () => {
    expect(toTitleCase("elite")).toBe("Elite");
  });

  it("the default fallback 'beginner' title-cases to 'Beginner'", () => {
    const defaultLevel = "beginner";
    const displayed = toTitleCase(defaultLevel);
    expect(displayed).toBe("Beginner");
    expect(displayed).not.toBe(defaultLevel);
  });

  it("the level label does not start with a lowercase letter", () => {
    const rawLevels = ["beginner", "intermediate", "advanced", "elite"];
    for (const level of rawLevels) {
      const displayed = toTitleCase(level);
      expect(displayed.charAt(0)).toBe(displayed.charAt(0).toUpperCase());
    }
  });
});
