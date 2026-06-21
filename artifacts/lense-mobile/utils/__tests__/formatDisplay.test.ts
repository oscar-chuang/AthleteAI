import { describe, it, expect } from "vitest";
import { toTitleCase } from "../formatDisplay";

describe("toTitleCase", () => {
  describe("single word", () => {
    it("capitalises a lowercase word", () => {
      expect(toTitleCase("running")).toBe("Running");
    });

    it("leaves an already-capitalised word unchanged", () => {
      expect(toTitleCase("Running")).toBe("Running");
    });

    it("handles an all-caps word", () => {
      expect(toTitleCase("YOGA")).toBe("YOGA");
    });

    it("handles a single-character word", () => {
      expect(toTitleCase("a")).toBe("A");
    });
  });

  describe("multi-word values", () => {
    it("capitalises each word in a two-word sport", () => {
      expect(toTitleCase("weight lifting")).toBe("Weight Lifting");
    });

    it("capitalises each word in a three-word value", () => {
      expect(toTitleCase("high jump run")).toBe("High Jump Run");
    });

    it("capitalises all lowercase level values", () => {
      expect(toTitleCase("intermediate athlete")).toBe("Intermediate Athlete");
    });

    it("handles mixed-case input by capitalising only the first character of each word", () => {
      expect(toTitleCase("rUnNiNg sHoEs")).toBe("RUnNiNg SHoEs");
    });
  });

  describe("level labels", () => {
    it("capitalises 'beginner'", () => {
      expect(toTitleCase("beginner")).toBe("Beginner");
    });

    it("capitalises 'intermediate'", () => {
      expect(toTitleCase("intermediate")).toBe("Intermediate");
    });

    it("capitalises 'advanced'", () => {
      expect(toTitleCase("advanced")).toBe("Advanced");
    });

    it("capitalises 'elite'", () => {
      expect(toTitleCase("elite")).toBe("Elite");
    });
  });

  describe("sport labels", () => {
    it("capitalises 'running'", () => {
      expect(toTitleCase("running")).toBe("Running");
    });

    it("capitalises 'swimming'", () => {
      expect(toTitleCase("swimming")).toBe("Swimming");
    });

    it("capitalises 'basketball'", () => {
      expect(toTitleCase("basketball")).toBe("Basketball");
    });

    it("capitalises 'weightlifting'", () => {
      expect(toTitleCase("weightlifting")).toBe("Weightlifting");
    });

    it("capitalises 'tennis'", () => {
      expect(toTitleCase("tennis")).toBe("Tennis");
    });
  });

  describe("empty string", () => {
    it("returns an empty string unchanged", () => {
      expect(toTitleCase("")).toBe("");
    });
  });

  describe("regression — raw DB values must never reach the UI", () => {
    it("treats the default level fallback 'beginner' as title-caseable", () => {
      const raw = "beginner";
      expect(toTitleCase(raw)).toBe("Beginner");
      expect(toTitleCase(raw)).not.toBe(raw);
    });

    it("treats a raw sport string 'cycling' as title-caseable", () => {
      const raw = "cycling";
      expect(toTitleCase(raw)).toBe("Cycling");
      expect(toTitleCase(raw)).not.toBe(raw);
    });

    it("treats a raw sport string 'soccer' as title-caseable", () => {
      const raw = "soccer";
      expect(toTitleCase(raw)).toBe("Soccer");
      expect(toTitleCase(raw)).not.toBe(raw);
    });
  });
});
