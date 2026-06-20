import { describe, it, expect } from "vitest";
import { formatBiomechanicsText } from "../formatBiomechanics";

describe("formatBiomechanicsText", () => {
  describe("edge cases", () => {
    it("returns empty string unchanged", () => {
      expect(formatBiomechanicsText("")).toBe("");
    });

    it("capitalises the first character of the result", () => {
      expect(formatBiomechanicsText("knee valgus is present")[0]).toBe("K");
    });

    it("preserves trailing punctuation", () => {
      expect(formatBiomechanicsText("knee valgus.")).toBe(
        "Knee caving inward."
      );
    });

    it("preserves text that needs no translation", () => {
      expect(formatBiomechanicsText("Keep your core tight.")).toBe(
        "Keep your core tight."
      );
    });
  });

  describe("original term map — regression guard", () => {
    it("knee valgus → knee caving inward", () => {
      expect(formatBiomechanicsText("knee valgus")).toBe("Knee caving inward");
    });

    it("knee varus → knee bowing outward", () => {
      expect(formatBiomechanicsText("knee varus")).toBe("Knee bowing outward");
    });

    it("lumbar flexion → lower back rounding", () => {
      expect(formatBiomechanicsText("lumbar flexion")).toBe(
        "Lower back rounding"
      );
    });

    it("thoracic kyphosis → upper back rounding", () => {
      expect(formatBiomechanicsText("thoracic kyphosis")).toBe(
        "Upper back rounding"
      );
    });

    it("anterior pelvic tilt → pelvis tilting forward", () => {
      expect(formatBiomechanicsText("anterior pelvic tilt")).toBe(
        "Pelvis tilting forward"
      );
    });

    it("ROM → range of motion", () => {
      expect(formatBiomechanicsText("ROM")).toBe("Range of motion");
    });

    it("eccentric → controlled lowering", () => {
      expect(formatBiomechanicsText("eccentric")).toBe("Controlled lowering");
    });

    it("proprioception → body position awareness", () => {
      expect(formatBiomechanicsText("proprioception")).toBe(
        "Body position awareness"
      );
    });
  });

  describe("injury / pathology terms", () => {
    it("proximal hamstring tendinopathy → hamstring tendon irritation near the hip", () => {
      expect(formatBiomechanicsText("proximal hamstring tendinopathy")).toBe(
        "Hamstring tendon irritation near the hip"
      );
    });

    it("hamstring tendinopathy (without proximal) → hamstring tendon irritation", () => {
      expect(formatBiomechanicsText("hamstring tendinopathy")).toBe(
        "Hamstring tendon irritation"
      );
    });

    it("patellar tendinopathy → kneecap tendon irritation", () => {
      expect(formatBiomechanicsText("patellar tendinopathy")).toBe(
        "Kneecap tendon irritation"
      );
    });

    it("achilles tendinopathy → Achilles tendon irritation", () => {
      expect(formatBiomechanicsText("achilles tendinopathy")).toBe(
        "Achilles tendon irritation"
      );
    });

    it("iliotibial band syndrome → outer knee and hip friction syndrome", () => {
      expect(formatBiomechanicsText("iliotibial band syndrome")).toBe(
        "Outer knee and hip friction syndrome"
      );
    });

    it("IT band syndrome → outer knee and hip friction syndrome", () => {
      expect(formatBiomechanicsText("IT band syndrome")).toBe(
        "Outer knee and hip friction syndrome"
      );
    });

    it("medial tibial stress syndrome → shin splints", () => {
      expect(formatBiomechanicsText("medial tibial stress syndrome")).toBe(
        "Shin splints"
      );
    });

    it("plantar fasciitis → heel and arch pain", () => {
      expect(formatBiomechanicsText("plantar fasciitis")).toBe(
        "Heel and arch pain"
      );
    });

    it("stress fracture → bone stress injury", () => {
      expect(formatBiomechanicsText("stress fracture")).toBe(
        "Bone stress injury"
      );
    });
  });

  describe("foot / lower leg anatomy", () => {
    it("tibial torsion → shin bone twist", () => {
      expect(formatBiomechanicsText("tibial torsion")).toBe("Shin bone twist");
    });

    it("pes planus → flat foot", () => {
      expect(formatBiomechanicsText("pes planus")).toBe("Flat foot");
    });

    it("pes cavus → high arch foot", () => {
      expect(formatBiomechanicsText("pes cavus")).toBe("High arch foot");
    });

    it("calcaneus → heel bone", () => {
      expect(formatBiomechanicsText("calcaneus")).toBe("Heel bone");
    });
  });

  describe("hip / pelvis anatomy", () => {
    it("Q-angle → knee tracking angle", () => {
      expect(formatBiomechanicsText("Q-angle")).toBe("Knee tracking angle");
    });

    it("iliopsoas → deep hip-bending muscle", () => {
      expect(formatBiomechanicsText("iliopsoas")).toBe(
        "Deep hip-bending muscle"
      );
    });

    it("gluteus maximus → large buttock muscle", () => {
      expect(formatBiomechanicsText("gluteus maximus")).toBe(
        "Large buttock muscle"
      );
    });

    it("gluteus medius → side buttock muscle", () => {
      expect(formatBiomechanicsText("gluteus medius")).toBe(
        "Side buttock muscle"
      );
    });

    it("piriformis → deep hip rotator muscle", () => {
      expect(formatBiomechanicsText("piriformis")).toBe(
        "Deep hip rotator muscle"
      );
    });

    it("pelvic obliquity → pelvis tilting sideways", () => {
      expect(formatBiomechanicsText("pelvic obliquity")).toBe(
        "Pelvis tilting sideways"
      );
    });
  });

  describe("shoulder anatomy", () => {
    it("scapular winging → shoulder blade sticking out", () => {
      expect(formatBiomechanicsText("scapular winging")).toBe(
        "Shoulder blade sticking out"
      );
    });

    it("rotator cuff → shoulder stabilizer muscles", () => {
      expect(formatBiomechanicsText("rotator cuff")).toBe(
        "Shoulder stabilizer muscles"
      );
    });

    it("scapula → shoulder blade", () => {
      expect(formatBiomechanicsText("scapula")).toBe("Shoulder blade");
    });

    it("scapular does not become 'shoulder blader' (word boundary guard)", () => {
      const result = formatBiomechanicsText("scapular winging");
      expect(result).toBe("Shoulder blade sticking out");
    });

    it("clavicle → collarbone", () => {
      expect(formatBiomechanicsText("clavicle")).toBe("Collarbone");
    });
  });

  describe("spine anatomy", () => {
    it("sacroiliac → pelvis joint", () => {
      expect(formatBiomechanicsText("sacroiliac")).toBe("Pelvis joint");
    });

    it("coccyx → tailbone", () => {
      expect(formatBiomechanicsText("coccyx")).toBe("Tailbone");
    });

    it("erector spinae → spinal support muscles", () => {
      expect(formatBiomechanicsText("erector spinae")).toBe(
        "Spinal support muscles"
      );
    });
  });

  describe("movement direction terms", () => {
    it("internal rotation → inward rotation", () => {
      expect(formatBiomechanicsText("internal rotation")).toBe(
        "Inward rotation"
      );
    });

    it("external rotation → outward rotation", () => {
      expect(formatBiomechanicsText("external rotation")).toBe(
        "Outward rotation"
      );
    });

    it("lateral flexion → side bending", () => {
      expect(formatBiomechanicsText("lateral flexion")).toBe("Side bending");
    });

    it("trunk lateral flexion → side bending", () => {
      expect(formatBiomechanicsText("trunk lateral flexion")).toBe(
        "Side bending"
      );
    });
  });

  describe("anatomical direction terms", () => {
    it("proximal → closer to the body", () => {
      expect(formatBiomechanicsText("proximal weakness")).toBe(
        "Closer to the body weakness"
      );
    });

    it("distal → farther from the body", () => {
      expect(formatBiomechanicsText("distal control")).toBe(
        "Farther from the body control"
      );
    });

    it("anterior → front-side", () => {
      expect(formatBiomechanicsText("anterior chain")).toBe(
        "Front-side chain"
      );
    });

    it("posterior → back-side", () => {
      expect(formatBiomechanicsText("posterior chain")).toBe(
        "Back-side chain"
      );
    });

    it("ipsilateral → same side", () => {
      expect(formatBiomechanicsText("ipsilateral hip drop")).toBe(
        "Same side hip dipping to one side"
      );
    });

    it("contralateral → opposite side", () => {
      expect(formatBiomechanicsText("contralateral arm swing")).toBe(
        "Opposite side arm swing"
      );
    });
  });

  describe("training science terms", () => {
    it("plyometric → explosive jump training", () => {
      expect(formatBiomechanicsText("plyometric loading")).toBe(
        "Explosive jump training loading"
      );
    });

    it("deceleration → controlled stopping", () => {
      expect(formatBiomechanicsText("deceleration phase")).toBe(
        "Controlled stopping phase"
      );
    });

    it("ground reaction force → impact force", () => {
      expect(formatBiomechanicsText("ground reaction force")).toBe(
        "Impact force"
      );
    });

    it("stride length → step distance", () => {
      expect(formatBiomechanicsText("stride length")).toBe("Step distance");
    });

    it("cadence → step rate", () => {
      expect(formatBiomechanicsText("cadence")).toBe("Step rate");
    });
  });

  describe("abbreviations", () => {
    it("GRF → impact force", () => {
      expect(formatBiomechanicsText("GRF peaks at toe-off")).toBe(
        "Impact force peaks at toe-off"
      );
    });

    it("COM → body's balance point", () => {
      expect(formatBiomechanicsText("COM displacement")).toBe(
        "Body's balance point displacement"
      );
    });
  });

  describe("double-translation prevention (single-pass guarantee)", () => {
    it("hyperextension → overextending, not 'hyperstraightening'", () => {
      expect(formatBiomechanicsText("hyperextension")).toBe("Overextending");
    });

    it("lumbar hyperextension compound takes priority over generic extension", () => {
      expect(formatBiomechanicsText("lumbar hyperextension")).toBe(
        "Lower back arching too much"
      );
    });

    it("compound 'hip flexion' is not re-scanned — replacement is emitted verbatim", () => {
      expect(formatBiomechanicsText("hip flexion")).toBe("Hip bending forward");
    });

    it("compound 'lateral flexion' wins over both lateral and flexion standalone rules", () => {
      expect(formatBiomechanicsText("lateral flexion")).toBe("Side bending");
    });

    it("replacement of one term is not fed into subsequent rules", () => {
      const result = formatBiomechanicsText(
        "hyperextension causes stress fracture risk"
      );
      expect(result).toBe(
        "Overextending causes bone stress injury risk"
      );
    });

    it("multiple overlapping-risk terms in one sentence each translate exactly once", () => {
      const result = formatBiomechanicsText(
        "lumbar hyperextension and hyperextension combined"
      );
      expect(result).toBe(
        "Lower back arching too much and overextending combined"
      );
    });
  });

  describe("case-insensitivity", () => {
    it("handles all-caps term", () => {
      expect(formatBiomechanicsText("KNEE VALGUS")).toBe("Knee caving inward");
    });

    it("handles mixed-case term", () => {
      expect(formatBiomechanicsText("Pes Planus")).toBe("Flat foot");
    });

    it("handles mid-sentence occurrence", () => {
      const result = formatBiomechanicsText(
        "There is significant knee valgus present."
      );
      expect(result).toBe("There is significant knee caving inward present.");
    });
  });

  describe("compound sentences with multiple terms", () => {
    it("replaces multiple distinct terms in one string", () => {
      const result = formatBiomechanicsText(
        "lumbar flexion combined with knee valgus increases injury risk."
      );
      expect(result).toContain("Lower back rounding");
      expect(result).toContain("knee caving inward");
    });

    it("replaces proximal hamstring tendinopathy and pelvic obliquity together", () => {
      const result = formatBiomechanicsText(
        "proximal hamstring tendinopathy linked to pelvic obliquity."
      );
      expect(result).toContain("Hamstring tendon irritation near the hip");
      expect(result).toContain("pelvis tilting sideways");
    });
  });

  describe("adjacent terms — spacing preserved between replacements", () => {
    it("two terms separated by a single space keep exactly one space between their replacements", () => {
      const result = formatBiomechanicsText("hip flexion knee valgus");
      expect(result).toBe("Hip bending forward knee caving inward");
    });

    it("three adjacent terms separated by single spaces keep one space between each replacement", () => {
      const result = formatBiomechanicsText(
        "hip flexion knee valgus lumbar flexion"
      );
      expect(result).toBe(
        "Hip bending forward knee caving inward lower back rounding"
      );
    });

    it("adjacent terms separated by a comma-space preserve the comma-space", () => {
      const result = formatBiomechanicsText("hip flexion, knee valgus");
      expect(result).toBe("Hip bending forward, knee caving inward");
    });

    it("adjacent terms separated by ' and ' preserve the conjunction", () => {
      const result = formatBiomechanicsText("knee valgus and lumbar flexion");
      expect(result).toBe("Knee caving inward and lower back rounding");
    });

    it("adjacent terms separated by ' — ' preserve the em-dash separator", () => {
      const result = formatBiomechanicsText(
        "hip flexion — knee valgus"
      );
      expect(result).toBe("Hip bending forward — knee caving inward");
    });
  });

  describe("terms at string boundaries — no extra whitespace or punctuation introduced", () => {
    it("term at the very start produces no leading whitespace", () => {
      const result = formatBiomechanicsText("knee valgus is present");
      expect(result).toBe("Knee caving inward is present");
      expect(result.startsWith("Knee")).toBe(true);
    });

    it("term at the very end produces no trailing whitespace", () => {
      const result = formatBiomechanicsText("the issue is knee valgus");
      expect(result).toBe("The issue is knee caving inward");
      expect(result.endsWith("inward")).toBe(true);
    });

    it("term at the very end followed by a full stop keeps the full stop flush", () => {
      const result = formatBiomechanicsText("the issue is knee valgus.");
      expect(result).toBe("The issue is knee caving inward.");
    });

    it("term at the very start followed by a colon keeps the colon flush", () => {
      const result = formatBiomechanicsText("knee valgus: a common finding");
      expect(result).toBe("Knee caving inward: a common finding");
    });

    it("term enclosed in parentheses preserves both parentheses without extra spaces", () => {
      const result = formatBiomechanicsText(
        "avoid (knee valgus) during loading"
      );
      expect(result).toBe("Avoid (knee caving inward) during loading");
    });

    it("term at start of string with trailing comma preserves the comma", () => {
      const result = formatBiomechanicsText("hip flexion, which is common");
      expect(result).toBe("Hip bending forward, which is common");
    });

    it("two adjacent terms at the very start of the string — first letter capitalised once only", () => {
      const result = formatBiomechanicsText("hip flexion knee valgus are present");
      expect(result.charAt(0)).toBe("H");
      expect(result).toBe("Hip bending forward knee caving inward are present");
    });

    it("term at end preceded immediately by punctuation preserves that punctuation", () => {
      const result = formatBiomechanicsText("watch for (knee valgus)");
      expect(result).toBe("Watch for (knee caving inward)");
    });
  });
});
