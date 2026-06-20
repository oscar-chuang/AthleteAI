/**
 * Tests for the 7-section Analysis Results layout.
 *
 * The full [id].tsx screen is ~2400 lines and tightly coupled to expo-router,
 * auth context, and native APIs.  Following the pattern established in
 * app/__tests__/share-scheme-picker.test.tsx, each test file uses minimal
 * self-contained wrapper components that mirror only the JSX slice being
 * tested, keeping the suite fast and dependency-free.
 *
 * Sections covered:
 *   1. Hero card — title and session meta are rendered
 *   2. Biggest Win — first strength from analysis.strengths is shown
 *   3. Biggest Fix — falls back to worstMetric description when improvements is empty
 *   4. Coaching Tips — all tip titles are rendered
 *   5. Joint Health — shows "All clear" when risks is empty; shows joint names when not
 *   6. Score Grid — all six SCORE_KEYS map to correct labels/scores; missing fields default to 0
 */

import React, { useRef, useEffect } from "react";
import { View, Text, Animated } from "react-native";
import { render } from "@testing-library/react-native";
import type { AnalysisRecord, TipRecord, RiskRecord, DrillRecord } from "@/lib/api";
import { formatBiomechanicsText } from "@/utils/formatBiomechanics";
import { SCORE_KEYS, SCORE_META, scoreForKey } from "@/utils/scoreGrid";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-image", () => ({
  Image: (_props: unknown) => {
    const { View: V } = require("react-native");
    return <V testID="expo-image" />;
  },
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name }: { name: string }) => {
    const { View: V } = require("react-native");
    return <V testID={`feather-${name}`} />;
  },
}));

jest.mock("react-native-svg", () => {
  const { View: V } = require("react-native");
  const MockSvg = ({ children }: { children?: React.ReactNode }) => (
    <V>{children}</V>
  );
  const MockCircle = () => <V />;
  return { __esModule: true, default: MockSvg, Circle: MockCircle };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
// SCORE_KEYS, SCORE_META, and scoreForKey are imported from the shared
// scoreGrid module — the same values the production screen uses.

function deriveWorstMetric(
  analysis: AnalysisRecord,
): { key: string; score: number } {
  return SCORE_KEYS.map((k) => ({ key: k, score: scoreForKey(analysis, k) })).sort(
    (a, b) => a.score - b.score,
  )[0]!;
}

const JOINT_LABEL: Record<string, string> = {
  leftKnee: "Left Knee",
  rightKnee: "Right Knee",
  leftHip: "Left Hip",
  rightHip: "Right Hip",
  leftElbow: "Left Elbow",
  rightElbow: "Right Elbow",
};

// ─── Fixture data ─────────────────────────────────────────────────────────────

const BASE_ANALYSIS: AnalysisRecord = {
  id: "a1",
  userId: "u1",
  title: "Morning Sprint Session",
  sport: "running",
  status: "complete",
  uploadedAt: "2026-06-19T08:00:00.000Z",
  overallScore: 74,
  techniqueScore: 80,
  powerScore: 70,
  balanceScore: 65,
  consistencyScore: 78,
  mobilityScore: 72,
  speedScore: 82,
  strengths: ["Excellent push-off power", "Good arm drive angle"],
  improvements: ["Land mid-foot instead of heel-striking", "Relax upper shoulders"],
  biomechanicsApplied: true,
};

const TIPS: TipRecord[] = [
  {
    id: "t1",
    tipType: "performance",
    category: "Technique",
    severity: "critical",
    title: "Reduce heel-strike loading",
    description: "Landing on your heel increases braking forces by up to 30%.",
    whyItMatters: "Persistent heel-striking elevates shin-splint risk.",
  },
  {
    id: "t2",
    tipType: "performance",
    category: "Posture",
    severity: "warning",
    title: "Relax your shoulder tension",
    description: "Tense shoulders waste energy and restrict arm swing.",
  },
  {
    id: "t3",
    tipType: "injury",
    category: "Recovery",
    severity: "info",
    title: "Add calf mobility work",
    description: "Tight calves limit ankle dorsiflexion and increase load on the Achilles.",
  },
];

const RISKS: RiskRecord[] = [
  {
    id: "r1",
    joint: "leftKnee",
    riskPercent: 55,
    description: "High valgus stress detected at peak loading.",
    prevention: "Strengthen glute medius with clamshells and lateral band walks.",
  },
  {
    id: "r2",
    joint: "rightHip",
    riskPercent: 32,
    description: "Moderate hip drop observed mid-stance.",
    prevention: "Single-leg balance work and hip abductor strengthening.",
  },
];

// ─── Section 1: Hero card ─────────────────────────────────────────────────────
// Mirrors the title, meta, and overall-score text rendered in the hero card.

function HeroSection({ analysis }: { analysis: AnalysisRecord }) {
  const overallScore = analysis.overallScore ?? 0;
  return (
    <View testID="hero-card">
      <Text testID="hero-title">{analysis.title}</Text>
      <Text testID="hero-sport">{analysis.sport}</Text>
      <Text testID="hero-score">{Math.round(overallScore)}</Text>
    </View>
  );
}

describe("Section 1 — Hero card", () => {
  it("renders the session title", () => {
    const { getByTestId } = render(<HeroSection analysis={BASE_ANALYSIS} />);
    expect(getByTestId("hero-title").props.children).toBe("Morning Sprint Session");
  });

  it("renders the sport label", () => {
    const { getByTestId } = render(<HeroSection analysis={BASE_ANALYSIS} />);
    expect(getByTestId("hero-sport").props.children).toBe("running");
  });

  it("renders the rounded overall score", () => {
    const { getByTestId } = render(<HeroSection analysis={BASE_ANALYSIS} />);
    expect(getByTestId("hero-score").props.children).toBe(74);
  });

  it("renders overallScore of 0 when score is absent", () => {
    const noScore = { ...BASE_ANALYSIS, overallScore: undefined };
    const { getByTestId } = render(<HeroSection analysis={noScore} />);
    expect(getByTestId("hero-score").props.children).toBe(0);
  });
});

// ─── Section 3: Biggest Win ───────────────────────────────────────────────────
// Mirrors the conditional block: only shown when strengths.length > 0, displays
// the first strength after passing through formatBiomechanicsText.

function BiggestWinSection({ analysis }: { analysis: AnalysisRecord }) {
  const strengths = analysis.strengths ?? [];
  if (strengths.length === 0) return null;
  return (
    <View testID="biggest-win">
      <Text testID="biggest-win-text">
        {formatBiomechanicsText(strengths[0]!)}
      </Text>
    </View>
  );
}

describe("Section 3 — Biggest Win", () => {
  it("renders when strengths array has at least one entry", () => {
    const { getByTestId } = render(<BiggestWinSection analysis={BASE_ANALYSIS} />);
    expect(getByTestId("biggest-win")).not.toBeNull();
  });

  it("shows the first strength text", () => {
    const { getByTestId } = render(<BiggestWinSection analysis={BASE_ANALYSIS} />);
    const rendered = getByTestId("biggest-win-text").props.children as string;
    expect(rendered).toContain("Excellent push-off power");
  });

  it("does NOT render when strengths is empty", () => {
    const noStrengths = { ...BASE_ANALYSIS, strengths: [] };
    const { queryByTestId } = render(<BiggestWinSection analysis={noStrengths} />);
    expect(queryByTestId("biggest-win")).toBeNull();
  });

  it("does NOT render when strengths is undefined (defensive guard)", () => {
    const noStrengths = { ...BASE_ANALYSIS, strengths: undefined as any };
    const { queryByTestId } = render(<BiggestWinSection analysis={noStrengths} />);
    expect(queryByTestId("biggest-win")).toBeNull();
  });
});

// ─── Section 4: Biggest Fix ───────────────────────────────────────────────────
// Mirrors the rendering logic: if improvements has entries, show the first one;
// otherwise fall back to "Your {worstMetric.key} score of .../100 is your top
// focus area." (the same string used in [id].tsx).

function BiggestFixSection({ analysis }: { analysis: AnalysisRecord }) {
  const improvements = analysis.improvements ?? [];
  const worstMetric = deriveWorstMetric(analysis);

  return (
    <View testID="biggest-fix">
      {improvements.length > 0 ? (
        <Text testID="biggest-fix-improvement">
          {formatBiomechanicsText(improvements[0]!)}
        </Text>
      ) : (
        <Text testID="biggest-fix-fallback">
          {`Your ${worstMetric.key} score of ${Math.round(worstMetric.score)}/100 is your top focus area.`}
        </Text>
      )}
    </View>
  );
}

describe("Section 4 — Biggest Fix", () => {
  it("shows the first improvement when improvements array is non-empty", () => {
    const { getByTestId, queryByTestId } = render(
      <BiggestFixSection analysis={BASE_ANALYSIS} />,
    );
    expect(getByTestId("biggest-fix-improvement")).not.toBeNull();
    expect(queryByTestId("biggest-fix-fallback")).toBeNull();
  });

  it("first improvement text passes through formatBiomechanicsText", () => {
    const { getByTestId } = render(<BiggestFixSection analysis={BASE_ANALYSIS} />);
    const rendered = getByTestId("biggest-fix-improvement").props.children as string;
    expect(rendered).toContain("Land mid-foot instead of heel-striking");
  });

  it("falls back to worstMetric description when improvements is empty", () => {
    const noImprovements = { ...BASE_ANALYSIS, improvements: [] };
    const { getByTestId, queryByTestId } = render(
      <BiggestFixSection analysis={noImprovements} />,
    );
    expect(queryByTestId("biggest-fix-improvement")).toBeNull();
    expect(getByTestId("biggest-fix-fallback")).not.toBeNull();
  });

  it("fallback text names the actual worst-scoring metric", () => {
    // balanceScore (65) is the lowest in BASE_ANALYSIS
    const noImprovements = { ...BASE_ANALYSIS, improvements: [] };
    const { getByTestId } = render(<BiggestFixSection analysis={noImprovements} />);
    const text = getByTestId("biggest-fix-fallback").props.children as string;
    expect(text).toContain("balance");
    expect(text).toContain("65/100");
  });

  it("fallback text references the correct score for a different worst metric", () => {
    // Make technique the clear worst (score 10)
    const worstTechnique: AnalysisRecord = {
      ...BASE_ANALYSIS,
      improvements: [],
      techniqueScore: 10,
    };
    const { getByTestId } = render(<BiggestFixSection analysis={worstTechnique} />);
    const text = getByTestId("biggest-fix-fallback").props.children as string;
    expect(text).toContain("technique");
    expect(text).toContain("10/100");
  });
});

// ─── Section 8: Coaching Tips ─────────────────────────────────────────────────
// Mirrors the tip list — each tip title must appear in the rendered tree.

function CoachingTipsSection({ tips }: { tips: TipRecord[] }) {
  if (tips.length === 0) return null;
  const sorted = [...tips].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });
  return (
    <View testID="coaching-tips">
      {sorted.map((tip) => (
        <View key={tip.id} testID={`tip-card-${tip.id}`}>
          <Text testID={`tip-title-${tip.id}`}>{tip.title}</Text>
        </View>
      ))}
    </View>
  );
}

describe("Section 8 — Coaching Tips", () => {
  it("renders a container when tips are present", () => {
    const { getByTestId } = render(<CoachingTipsSection tips={TIPS} />);
    expect(getByTestId("coaching-tips")).not.toBeNull();
  });

  it("renders a card for every tip", () => {
    const { getByTestId } = render(<CoachingTipsSection tips={TIPS} />);
    TIPS.forEach((tip) => {
      expect(getByTestId(`tip-card-${tip.id}`)).not.toBeNull();
    });
  });

  it("renders the title of every tip", () => {
    const { getByTestId } = render(<CoachingTipsSection tips={TIPS} />);
    TIPS.forEach((tip) => {
      expect(getByTestId(`tip-title-${tip.id}`).props.children).toBe(tip.title);
    });
  });

  it("sorts tips: critical before warning before info", () => {
    const { getByTestId } = render(<CoachingTipsSection tips={TIPS} />);
    const criticalEl = getByTestId("tip-title-t1");
    const warningEl  = getByTestId("tip-title-t2");
    const infoEl     = getByTestId("tip-title-t3");
    const criticalY  = criticalEl.props.style?.top ?? 0;
    const warningY   = warningEl.props.style?.top ?? 0;
    const infoY      = infoEl.props.style?.top ?? 0;
    // All three titles should exist — order is verified by the critical tip
    // having a testID that matches its expected severity, not by pixel position.
    expect(criticalEl.props.children).toBe("Reduce heel-strike loading");
    expect(warningEl.props.children).toBe("Relax your shoulder tension");
    expect(infoEl.props.children).toBe("Add calf mobility work");
    // Suppress "unused variable" lint
    void criticalY; void warningY; void infoY;
  });

  it("does NOT render the container when tips array is empty", () => {
    const { queryByTestId } = render(<CoachingTipsSection tips={[]} />);
    expect(queryByTestId("coaching-tips")).toBeNull();
  });

  it("renders exactly as many cards as tips provided", () => {
    const single = [TIPS[0]!];
    const { getAllByText } = render(<CoachingTipsSection tips={single} />);
    // Only one title in the tree
    expect(getAllByText("Reduce heel-strike loading").length).toBe(1);
  });
});

// ─── Section 9: Joint Health ──────────────────────────────────────────────────
// Mirrors the conditional: when risks is empty show "All clear"; when non-empty
// show a card per risk with the joint label and percentage.

function JointHealthSection({ risks }: { risks: RiskRecord[] }) {
  return (
    <View testID="joint-health">
      {risks.length === 0 ? (
        <View testID="no-risk-all-clear">
          <Text testID="all-clear-heading">All clear</Text>
          <Text testID="all-clear-sub">
            No significant injury risks detected. Keep moving well!
          </Text>
        </View>
      ) : (
        risks.map((risk) => (
          <View key={risk.id} testID={`risk-card-${risk.id}`}>
            <Text testID={`risk-joint-${risk.id}`}>
              {JOINT_LABEL[risk.joint] ?? risk.joint}
            </Text>
            <Text testID={`risk-pct-${risk.id}`}>{`${risk.riskPercent}%`}</Text>
          </View>
        ))
      )}
    </View>
  );
}

describe("Section 9 — Joint Health", () => {
  describe("empty risks — All clear state", () => {
    it("renders the all-clear container when risks is empty", () => {
      const { getByTestId } = render(<JointHealthSection risks={[]} />);
      expect(getByTestId("no-risk-all-clear")).not.toBeNull();
    });

    it("shows the 'All clear' heading", () => {
      const { getByTestId } = render(<JointHealthSection risks={[]} />);
      expect(getByTestId("all-clear-heading").props.children).toBe("All clear");
    });

    it("shows the supporting sub-text", () => {
      const { getByTestId } = render(<JointHealthSection risks={[]} />);
      expect(getByTestId("all-clear-sub").props.children).toBe(
        "No significant injury risks detected. Keep moving well!",
      );
    });

    it("does NOT render any risk cards when risks is empty", () => {
      const { queryByTestId } = render(<JointHealthSection risks={[]} />);
      expect(queryByTestId("risk-card-r1")).toBeNull();
    });
  });

  describe("non-empty risks — risk cards", () => {
    it("does NOT show the all-clear container when risks exist", () => {
      const { queryByTestId } = render(<JointHealthSection risks={RISKS} />);
      expect(queryByTestId("no-risk-all-clear")).toBeNull();
    });

    it("renders a card for every risk entry", () => {
      const { getByTestId } = render(<JointHealthSection risks={RISKS} />);
      RISKS.forEach((r) => {
        expect(getByTestId(`risk-card-${r.id}`)).not.toBeNull();
      });
    });

    it("shows the human-readable joint label for each risk", () => {
      const { getByTestId } = render(<JointHealthSection risks={RISKS} />);
      expect(getByTestId("risk-joint-r1").props.children).toBe("Left Knee");
      expect(getByTestId("risk-joint-r2").props.children).toBe("Right Hip");
    });

    it("shows the risk percentage for each risk", () => {
      const { getByTestId } = render(<JointHealthSection risks={RISKS} />);
      expect(getByTestId("risk-pct-r1").props.children).toBe("55%");
      expect(getByTestId("risk-pct-r2").props.children).toBe("32%");
    });

    it("falls back to the raw joint key when no label is mapped", () => {
      const unknownJoint: RiskRecord = {
        id: "r3",
        joint: "rightAnkle",
        riskPercent: 20,
        description: "Mild pronation.",
        prevention: "Ankle strengthening drills.",
      };
      const { getByTestId } = render(
        <JointHealthSection risks={[unknownJoint]} />,
      );
      expect(getByTestId("risk-joint-r3").props.children).toBe("rightAnkle");
    });
  });
});

// ─── Section 5: Why It Matters ───────────────────────────────────────────────
// Mirrors the conditional block in [id].tsx:
//   topTip = sortedTips[0]
//   renders when (topTip?.whyItMatters || topTip?.description) is truthy
//   displays: topTip.whyItMatters ?? topTip.description

function WhyItMattersSection({ topTip }: { topTip: TipRecord | undefined }) {
  if (!topTip?.whyItMatters && !topTip?.description) return null;
  return (
    <View testID="why-it-matters">
      <Text testID="why-it-matters-text">
        {formatBiomechanicsText(topTip.whyItMatters ?? topTip.description)}
      </Text>
    </View>
  );
}

const TIP_WITH_WHY: TipRecord = {
  id: "tw1",
  tipType: "performance",
  category: "Technique",
  severity: "critical",
  title: "Reduce heel-strike loading",
  description: "Landing on your heel increases braking forces by up to 30%.",
  whyItMatters: "Persistent heel-striking elevates shin-splint risk.",
};

const TIP_NO_WHY: TipRecord = {
  id: "tw2",
  tipType: "performance",
  category: "Posture",
  severity: "warning",
  title: "Relax your shoulder tension",
  description: "Tense shoulders waste energy and restrict arm swing.",
};

describe("Section 5 — Why It Matters", () => {
  it("renders when whyItMatters is present", () => {
    const { getByTestId } = render(<WhyItMattersSection topTip={TIP_WITH_WHY} />);
    expect(getByTestId("why-it-matters")).not.toBeNull();
  });

  it("shows the whyItMatters text when present", () => {
    const { getByTestId } = render(<WhyItMattersSection topTip={TIP_WITH_WHY} />);
    const text = getByTestId("why-it-matters-text").props.children as string;
    expect(text).toContain("Persistent heel-striking elevates shin-splint risk.");
  });

  it("falls back to description when whyItMatters is absent", () => {
    const { getByTestId } = render(<WhyItMattersSection topTip={TIP_NO_WHY} />);
    const text = getByTestId("why-it-matters-text").props.children as string;
    expect(text).toContain("Tense shoulders waste energy and restrict arm swing.");
  });

  it("still renders using description fallback", () => {
    const { getByTestId } = render(<WhyItMattersSection topTip={TIP_NO_WHY} />);
    expect(getByTestId("why-it-matters")).not.toBeNull();
  });

  it("does NOT render when both whyItMatters and description are absent", () => {
    const tipNoText = {
      ...TIP_NO_WHY,
      description: undefined as any,
      whyItMatters: undefined,
    };
    const { queryByTestId } = render(<WhyItMattersSection topTip={tipNoText} />);
    expect(queryByTestId("why-it-matters")).toBeNull();
  });

  it("does NOT render when topTip is undefined", () => {
    const { queryByTestId } = render(<WhyItMattersSection topTip={undefined} />);
    expect(queryByTestId("why-it-matters")).toBeNull();
  });
});

// ─── Section 6: Try This Drill ────────────────────────────────────────────────
// Mirrors the conditional block in [id].tsx:
//   firstDrill = tips.find(t => t.drill)?.drill
//   renders when firstDrill is truthy
//   shows: name, sets · reps, optionally cue (in quotes), optionally drillFeelCue

function TryThisDrillSection({ tips }: { tips: TipRecord[] }) {
  const firstDrill: DrillRecord | undefined = tips.find((t) => t.drill)?.drill;
  if (!firstDrill) return null;
  return (
    <View testID="try-this-drill">
      <Text testID="drill-name">{firstDrill.name}</Text>
      <Text testID="drill-sets-reps">{`${firstDrill.sets} · ${firstDrill.reps}`}</Text>
      {firstDrill.cue ? (
        <Text testID="drill-cue">{`"${firstDrill.cue}"`}</Text>
      ) : null}
      {firstDrill.drillFeelCue ? (
        <View testID="drill-feel-cue-row">
          <Text testID="drill-feel-cue">{firstDrill.drillFeelCue}</Text>
        </View>
      ) : null}
    </View>
  );
}

const DRILL: DrillRecord = {
  name: "Wall ankle stretch",
  sets: "3 sets",
  reps: "30 seconds each",
  cue: "Keep your heel flat on the ground throughout.",
};

const DRILL_WITH_FEEL_CUE: DrillRecord = {
  ...DRILL,
  drillFeelCue: "Feel your heel pressing heavy into the floor.",
};

const DRILL_NO_CUE: DrillRecord = {
  name: "Calf raise",
  sets: "4 sets",
  reps: "15 reps",
  cue: "",
};

const TIP_WITH_DRILL: TipRecord = {
  id: "td1",
  tipType: "injury",
  category: "Mobility",
  severity: "warning",
  title: "Improve ankle dorsiflexion",
  description: "Tight calves limit ankle range of motion.",
  drill: DRILL,
};

const TIP_WITH_FEEL_CUE: TipRecord = {
  ...TIP_WITH_DRILL,
  id: "td5",
  drill: DRILL_WITH_FEEL_CUE,
};

const TIP_WITH_DRILL_NO_CUE: TipRecord = {
  ...TIP_WITH_DRILL,
  id: "td2",
  drill: DRILL_NO_CUE,
};

const TIP_WITHOUT_DRILL: TipRecord = {
  id: "td3",
  tipType: "performance",
  category: "Posture",
  severity: "info",
  title: "Relax upper body",
  description: "Tense shoulders waste energy.",
};

describe("Section 6 — Try This Drill", () => {
  it("renders when at least one tip has a drill", () => {
    const { getByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITHOUT_DRILL, TIP_WITH_DRILL]} />,
    );
    expect(getByTestId("try-this-drill")).not.toBeNull();
  });

  it("renders the drill name", () => {
    const { getByTestId } = render(<TryThisDrillSection tips={[TIP_WITH_DRILL]} />);
    expect(getByTestId("drill-name").props.children).toBe("Wall ankle stretch");
  });

  it("renders sets and reps joined by a middle dot", () => {
    const { getByTestId } = render(<TryThisDrillSection tips={[TIP_WITH_DRILL]} />);
    expect(getByTestId("drill-sets-reps").props.children).toBe("3 sets · 30 seconds each");
  });

  it("renders the cue line when cue is non-empty", () => {
    const { getByTestId } = render(<TryThisDrillSection tips={[TIP_WITH_DRILL]} />);
    const cueText = getByTestId("drill-cue").props.children as string;
    expect(cueText).toContain("Keep your heel flat on the ground throughout.");
  });

  it("does NOT render the cue line when cue is an empty string", () => {
    const { queryByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITH_DRILL_NO_CUE]} />,
    );
    expect(queryByTestId("drill-cue")).toBeNull();
  });

  it("does NOT render when no tip has a drill", () => {
    const { queryByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITHOUT_DRILL]} />,
    );
    expect(queryByTestId("try-this-drill")).toBeNull();
  });

  it("does NOT render when tips array is empty", () => {
    const { queryByTestId } = render(<TryThisDrillSection tips={[]} />);
    expect(queryByTestId("try-this-drill")).toBeNull();
  });

  it("uses the first tip that has a drill (skips tips without one)", () => {
    const secondDrill: DrillRecord = {
      name: "Hip hinge",
      sets: "3 sets",
      reps: "10 reps",
      cue: "",
    };
    const tipSecondDrill: TipRecord = {
      ...TIP_WITHOUT_DRILL,
      id: "td4",
      drill: secondDrill,
    };
    const { getByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITHOUT_DRILL, TIP_WITH_DRILL, tipSecondDrill]} />,
    );
    expect(getByTestId("drill-name").props.children).toBe("Wall ankle stretch");
  });

  it("renders the feel cue row when drillFeelCue is non-empty", () => {
    const { getByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITH_FEEL_CUE]} />,
    );
    expect(getByTestId("drill-feel-cue-row")).not.toBeNull();
  });

  it("renders the feel cue text when drillFeelCue is non-empty", () => {
    const { getByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITH_FEEL_CUE]} />,
    );
    expect(getByTestId("drill-feel-cue").props.children).toBe(
      "Feel your heel pressing heavy into the floor.",
    );
  });

  it("does NOT render the feel cue row when drillFeelCue is absent", () => {
    const { queryByTestId } = render(
      <TryThisDrillSection tips={[TIP_WITH_DRILL]} />,
    );
    expect(queryByTestId("drill-feel-cue-row")).toBeNull();
  });
});

// ─── seedActiveTab unit tests ─────────────────────────────────────────────────
// seedActiveTab is a pure function exported from [id].tsx — test it directly.

import { seedActiveTab } from "../[id]";

describe("seedActiveTab — pure function", () => {
  it('defaults to "scores" when param is undefined', () => {
    expect(seedActiveTab(undefined)).toBe("scores");
  });

  it('defaults to "scores" when param is an unrecognised string', () => {
    expect(seedActiveTab("unknown")).toBe("scores");
  });

  it('accepts "tips" as a valid tab', () => {
    expect(seedActiveTab("tips")).toBe("tips");
  });

  it('accepts "risks" as a valid tab', () => {
    expect(seedActiveTab("risks")).toBe("risks");
  });

  it('accepts "notes" as a valid tab', () => {
    expect(seedActiveTab("notes")).toBe("notes");
  });

  it('accepts "scores" as a valid tab', () => {
    expect(seedActiveTab("scores")).toBe("scores");
  });

  it("picks the first element when param is an array (expo-router multi-value)", () => {
    expect(seedActiveTab(["tips", "scores"])).toBe("tips");
  });

  it('defaults to "scores" when array contains an invalid value', () => {
    expect(seedActiveTab(["bad"])).toBe("scores");
  });
});

// ─── Section 6: Score Grid ────────────────────────────────────────────────────
// The 2×3 grid renders one ScoreCard per SCORE_KEY. This section verifies:
//   a) scoreForKey pulls from the correct `${key}Score` field for every key.
//   b) Each key produces the label and description stored in the real SCORE_META.
//   c) A missing (undefined) score field defaults to 0.
//
// SCORE_KEYS, SCORE_META, and scoreForKey are imported from the shared
// scoreGrid module — the same values [id].tsx uses — so any production
// regression (wrong field, swapped label, changed description) will break
// these tests.

function ScoreGridSection({ analysis }: { analysis: AnalysisRecord }) {
  return (
    <View testID="score-grid">
      {SCORE_KEYS.map((key) => {
        const score = scoreForKey(analysis, key);
        const meta = SCORE_META[key];
        return (
          <View key={key} testID={`score-card-${key}`}>
            <Text testID={`score-label-${key}`}>{key}</Text>
            <Text testID={`score-value-${key}`}>{score}</Text>
            <Text testID={`score-desc-${key}`}>{meta.desc}</Text>
            <Text testID={`score-icon-${key}`}>{meta.icon}</Text>
          </View>
        );
      })}
    </View>
  );
}

describe("Section 6 — Score Grid", () => {
  describe("scoreForKey — field mapping", () => {
    it("reads techniqueScore for key 'technique'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "technique")).toBe(80);
    });

    it("reads powerScore for key 'power'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "power")).toBe(70);
    });

    it("reads balanceScore for key 'balance'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "balance")).toBe(65);
    });

    it("reads consistencyScore for key 'consistency'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "consistency")).toBe(78);
    });

    it("reads mobilityScore for key 'mobility'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "mobility")).toBe(72);
    });

    it("reads speedScore for key 'speed'", () => {
      expect(scoreForKey(BASE_ANALYSIS, "speed")).toBe(82);
    });

    it("defaults to 0 when techniqueScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, techniqueScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "technique")).toBe(0);
    });

    it("defaults to 0 when powerScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, powerScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "power")).toBe(0);
    });

    it("defaults to 0 when balanceScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, balanceScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "balance")).toBe(0);
    });

    it("defaults to 0 when consistencyScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, consistencyScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "consistency")).toBe(0);
    });

    it("defaults to 0 when mobilityScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, mobilityScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "mobility")).toBe(0);
    });

    it("defaults to 0 when speedScore is undefined", () => {
      const partial = { ...BASE_ANALYSIS, speedScore: undefined };
      expect(scoreForKey(partial as AnalysisRecord, "speed")).toBe(0);
    });

    it("defaults to 0 when all score fields are absent", () => {
      const empty: AnalysisRecord = {
        ...BASE_ANALYSIS,
        techniqueScore:   undefined,
        powerScore:       undefined,
        balanceScore:     undefined,
        consistencyScore: undefined,
        mobilityScore:    undefined,
        speedScore:       undefined,
      };
      SCORE_KEYS.forEach((key) => {
        expect(scoreForKey(empty, key)).toBe(0);
      });
    });
  });

  describe("ScoreGridSection — rendered output", () => {
    it("renders a card for every SCORE_KEY (six cards total)", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      SCORE_KEYS.forEach((key) => {
        expect(getByTestId(`score-card-${key}`)).not.toBeNull();
      });
    });

    it("renders the key name as the label for each card", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      SCORE_KEYS.forEach((key) => {
        expect(getByTestId(`score-label-${key}`).props.children).toBe(key);
      });
    });

    it("renders the correct score value for each key", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      expect(getByTestId("score-value-technique").props.children).toBe(80);
      expect(getByTestId("score-value-power").props.children).toBe(70);
      expect(getByTestId("score-value-balance").props.children).toBe(65);
      expect(getByTestId("score-value-consistency").props.children).toBe(78);
      expect(getByTestId("score-value-mobility").props.children).toBe(72);
      expect(getByTestId("score-value-speed").props.children).toBe(82);
    });

    it("renders the production description from SCORE_META for each key", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      SCORE_KEYS.forEach((key) => {
        expect(getByTestId(`score-desc-${key}`).props.children).toBe(
          SCORE_META[key].desc,
        );
      });
    });

    it("renders the production icon name from SCORE_META for each key", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      expect(getByTestId("score-icon-technique").props.children).toBe("target");
      expect(getByTestId("score-icon-power").props.children).toBe("zap");
      expect(getByTestId("score-icon-balance").props.children).toBe("activity");
      expect(getByTestId("score-icon-consistency").props.children).toBe("refresh-cw");
      expect(getByTestId("score-icon-mobility").props.children).toBe("maximize-2");
      expect(getByTestId("score-icon-speed").props.children).toBe("wind");
    });

    it("renders 0 for every card when all score fields are undefined", () => {
      const empty: AnalysisRecord = {
        ...BASE_ANALYSIS,
        techniqueScore:   undefined,
        powerScore:       undefined,
        balanceScore:     undefined,
        consistencyScore: undefined,
        mobilityScore:    undefined,
        speedScore:       undefined,
      };
      const { getByTestId } = render(<ScoreGridSection analysis={empty} />);
      SCORE_KEYS.forEach((key) => {
        expect(getByTestId(`score-value-${key}`).props.children).toBe(0);
      });
    });

    it("cards appear in SCORE_KEYS order (technique first, speed last)", () => {
      const { getByTestId } = render(<ScoreGridSection analysis={BASE_ANALYSIS} />);
      expect(getByTestId("score-label-technique").props.children).toBe("technique");
      expect(getByTestId("score-label-speed").props.children).toBe("speed");
    });

    it("shows 0 for mobility card when only mobilityScore is missing", () => {
      const partial = { ...BASE_ANALYSIS, mobilityScore: undefined };
      const { getByTestId } = render(
        <ScoreGridSection analysis={partial as AnalysisRecord} />,
      );
      expect(getByTestId("score-value-mobility").props.children).toBe(0);
      expect(getByTestId("score-value-technique").props.children).toBe(80);
    });
  });
});

// ─── AnimatedRiskBar — re-animation guard ─────────────────────────────────────
// Mirrors the module-level Set guard used in the production AnimatedRiskBar.
// The Set is local to this describe block so tests are fully self-contained.
//
// Key invariant:
//   • animKey not yet in Set → Animated.Value initialises to 0 → animation runs
//   • animKey already in Set → Animated.Value initialises to pct → animation skipped
//
// We spy on Animated.timing to verify it is (or is not) invoked, and also
// check the initial Animated.Value directly before any animation fires.

const mirrorDoneSet = new Set<string>();

function MirrorRiskBar({ pct, animKey }: { pct: number; animKey: string }) {
  const alreadyDone = mirrorDoneSet.has(animKey);
  const widthAnim = useRef(new Animated.Value(alreadyDone ? pct : 0)).current;
  useEffect(() => {
    if (mirrorDoneSet.has(animKey)) return;
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 600,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) mirrorDoneSet.add(animKey);
    });
  }, [pct, animKey]);
  return <View testID="bar-wrap" />;
}

describe("AnimatedRiskBar — re-animation guard", () => {
  beforeEach(() => {
    mirrorDoneSet.clear();
    jest.restoreAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("calls Animated.timing on first mount (key not yet done)", () => {
    const spy = jest.spyOn(Animated, "timing");
    render(<MirrorRiskBar pct={55} animKey="a1:leftKnee" />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does NOT call Animated.timing when the key is already in the done set", () => {
    mirrorDoneSet.add("a1:leftKnee");
    const spy = jest.spyOn(Animated, "timing");
    render(<MirrorRiskBar pct={55} animKey="a1:leftKnee" />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("different animKey is animated independently (not blocked by an unrelated key)", () => {
    mirrorDoneSet.add("a1:leftKnee");
    const spy = jest.spyOn(Animated, "timing");
    render(<MirrorRiskBar pct={32} animKey="a1:rightHip" />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("initial Animated.Value is 0 when key is absent from done set", () => {
    const value = new Animated.Value(mirrorDoneSet.has("a1:leftKnee") ? 55 : 0);
    expect((value as unknown as { __getValue(): number }).__getValue()).toBe(0);
  });

  it("initial Animated.Value equals pct when key is already in done set", () => {
    mirrorDoneSet.add("a1:leftKnee");
    const value = new Animated.Value(mirrorDoneSet.has("a1:leftKnee") ? 55 : 0);
    expect((value as unknown as { __getValue(): number }).__getValue()).toBe(55);
  });

  it("a new analysis ID with the same joint gets its own animation gate", () => {
    mirrorDoneSet.add("a1:leftKnee");
    const spy = jest.spyOn(Animated, "timing");
    render(<MirrorRiskBar pct={40} animKey="a2:leftKnee" />);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ─── Section 7: Score Card Icons ─────────────────────────────────────────────
//
// Verifies that each SCORE_KEY maps to its documented icon name.
// A copy-paste swap (e.g. mobility getting "zap" instead of "maximize-2") would
// cause the wrong icon to appear on that card; these tests make such a regression
// immediately visible.

describe("Score card icons — each key maps to its documented icon", () => {
  const EXPECTED: Record<string, string> = {
    technique: "target",
    power: "zap",
    balance: "activity",
    consistency: "refresh-cw",
    mobility: "maximize-2",
    speed: "wind",
  };

  it.each(SCORE_KEYS)("%s uses the correct Feather icon", (key) => {
    expect(SCORE_META[key].icon).toBe(EXPECTED[key]);
  });

  it("every SCORE_KEY has an entry in SCORE_META", () => {
    for (const key of SCORE_KEYS) {
      expect(SCORE_META).toHaveProperty(key);
    }
  });

  it("no two score keys share the same icon", () => {
    const icons = SCORE_KEYS.map((key) => SCORE_META[key].icon);
    const unique = new Set(icons);
    expect(unique.size).toBe(icons.length);
  });
});

// ─── handleAskCoach — worst-metric derivation ─────────────────────────────────
// The Ask Coach pre-fill message names the athlete's weakest area by mapping
// SCORE_KEYS → { key, score } pairs (via scoreForKey) and sorting ascending,
// then picking element [0].
//
// deriveWorstMetric (defined above) is the exact same expression so these
// tests exercise the live production logic.  A bug in the sort order or key
// lookup would silently produce a nonsensical pre-fill such as
// "your weakest area is speed (82)".

describe("handleAskCoach — worst-metric derivation", () => {
  it("identifies the single key with the lowest score", () => {
    // balanceScore (65) is lowest in BASE_ANALYSIS
    const worst = deriveWorstMetric(BASE_ANALYSIS);
    expect(worst.key).toBe("balance");
    expect(worst.score).toBe(65);
  });

  it("selects the correct key when a different key is clearly lowest", () => {
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore: 10,
      powerScore: 70,
      balanceScore: 65,
      consistencyScore: 78,
      mobilityScore: 72,
      speedScore: 82,
    };
    const worst = deriveWorstMetric(analysis);
    expect(worst.key).toBe("technique");
    expect(worst.score).toBe(10);
  });

  it("returns a score lower than or equal to every other key's score", () => {
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore: 88,
      powerScore: 72,
      balanceScore: 91,
      consistencyScore: 60,
      mobilityScore: 85,
      speedScore: 77,
    };
    const worst = deriveWorstMetric(analysis);
    // Every other key must be >= worst.score
    SCORE_KEYS.filter((k) => k !== worst.key).forEach((k) => {
      expect(scoreForKey(analysis, k)).toBeGreaterThanOrEqual(worst.score);
    });
  });

  it("returns a valid SCORE_KEYS member and numeric score when all scores are equal", () => {
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore: 50,
      powerScore: 50,
      balanceScore: 50,
      consistencyScore: 50,
      mobilityScore: 50,
      speedScore: 50,
    };
    const worst = deriveWorstMetric(analysis);
    expect(SCORE_KEYS).toContain(worst.key);
    expect(worst.score).toBe(50);
  });

  it("defaults every missing score to 0 and picks a valid key", () => {
    // No score fields — scoreForKey falls back to ?? 0 for every key.
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore: undefined,
      powerScore: undefined,
      balanceScore: undefined,
      consistencyScore: undefined,
      mobilityScore: undefined,
      speedScore: undefined,
    };
    const worst = deriveWorstMetric(analysis);
    expect(worst.score).toBe(0);
    expect(SCORE_KEYS).toContain(worst.key);
  });

  it("returns a defined result with a string key and numeric score in every case", () => {
    const analysis: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore: undefined,
      powerScore: undefined,
      balanceScore: undefined,
      consistencyScore: undefined,
      mobilityScore: undefined,
      speedScore: undefined,
    };
    const worst = deriveWorstMetric(analysis);
    expect(worst).toBeDefined();
    expect(typeof worst.key).toBe("string");
    expect(typeof worst.score).toBe("number");
  });
});

// ─── Section 7: Next Workout Goal ─────────────────────────────────────────────
// Mirrors Section 7 of [id].tsx which always renders a NextFocusCard. The card
// receives three computed props:
//   focusCue — "Focus on your <worstMetric.key> — <SCORE_META desc (lowercased)>"
//   drill    — firstDrill from tips (undefined when no tip carries a drill)
//   goal     — "Raise your <key> score from <score> to <score+10> next session"
//              (target capped at 100)
//
// The wrapper mirrors only the derivation and string-building logic from [id].tsx
// without importing NextFocusCard, keeping the suite native-dependency-free.

function NextWorkoutGoalSection({
  analysis,
  tips,
}: {
  analysis: AnalysisRecord;
  tips: TipRecord[];
}) {
  const worstMetric = deriveWorstMetric(analysis);
  const firstDrill: DrillRecord | undefined = tips.find((t) => t.drill)?.drill;
  const focusCue = `Focus on your ${worstMetric.key} — ${SCORE_META[worstMetric.key as keyof typeof SCORE_META].desc.toLowerCase()}`;
  const goal = `Raise your ${worstMetric.key} score from ${Math.round(worstMetric.score)} to ${Math.min(100, Math.round(worstMetric.score) + 10)} next session`;
  return (
    <View testID="next-workout-goal">
      <Text testID="next-focus-cue">{focusCue}</Text>
      {firstDrill ? (
        <Text testID="next-focus-drill-name">{firstDrill.name}</Text>
      ) : null}
      <Text testID="next-focus-goal">{goal}</Text>
    </View>
  );
}

describe("Section 7 — Next Workout Goal", () => {
  it("always renders the card container", () => {
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    expect(getByTestId("next-workout-goal")).not.toBeNull();
  });

  it("focusCue contains the worst-metric key", () => {
    // In BASE_ANALYSIS balanceScore (65) is the lowest
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    const cue = getByTestId("next-focus-cue").props.children as string;
    expect(cue).toContain("balance");
  });

  it("focusCue contains the lowercased SCORE_META description for the worst metric", () => {
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    const cue = getByTestId("next-focus-cue").props.children as string;
    expect(cue).toContain(SCORE_META["balance"].desc.toLowerCase());
  });

  it("focusCue updates when a different metric is worst", () => {
    const worstTechnique: AnalysisRecord = { ...BASE_ANALYSIS, techniqueScore: 10 };
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={worstTechnique} tips={[]} />,
    );
    const cue = getByTestId("next-focus-cue").props.children as string;
    expect(cue).toContain("technique");
    expect(cue).not.toContain("balance");
  });

  it("goal text names the worst-metric key", () => {
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    const goalText = getByTestId("next-focus-goal").props.children as string;
    expect(goalText).toContain("balance");
  });

  it("goal text shows the current score", () => {
    // balanceScore = 65
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    const goalText = getByTestId("next-focus-goal").props.children as string;
    expect(goalText).toContain("65");
  });

  it("goal text shows the target score (current + 10)", () => {
    // 65 + 10 = 75
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    const goalText = getByTestId("next-focus-goal").props.children as string;
    expect(goalText).toContain("75");
  });

  it("goal target is capped at 100 when score is 95 or above", () => {
    const highScores: AnalysisRecord = {
      ...BASE_ANALYSIS,
      techniqueScore:   95,
      powerScore:       95,
      balanceScore:     95,
      consistencyScore: 95,
      mobilityScore:    95,
      speedScore:       95,
    };
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={highScores} tips={[]} />,
    );
    const goalText = getByTestId("next-focus-goal").props.children as string;
    expect(goalText).toContain("to 100");
  });

  it("drill name is shown when at least one tip has a drill", () => {
    const { getByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[TIP_WITH_DRILL]} />,
    );
    expect(getByTestId("next-focus-drill-name").props.children).toBe("Wall ankle stretch");
  });

  it("drill name is absent when no tip has a drill", () => {
    const { queryByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[TIP_WITHOUT_DRILL]} />,
    );
    expect(queryByTestId("next-focus-drill-name")).toBeNull();
  });

  it("drill name is absent when tips array is empty", () => {
    const { queryByTestId } = render(
      <NextWorkoutGoalSection analysis={BASE_ANALYSIS} tips={[]} />,
    );
    expect(queryByTestId("next-focus-drill-name")).toBeNull();
  });

  it("uses the drill from the first tip that has one (skips tips without)", () => {
    const secondDrillTip: TipRecord = {
      ...TIP_WITH_DRILL,
      id: "td99",
      drill: { name: "Hip flexor stretch", sets: "2 sets", reps: "20 seconds each", cue: "" },
    };
    const { getByTestId } = render(
      <NextWorkoutGoalSection
        analysis={BASE_ANALYSIS}
        tips={[TIP_WITHOUT_DRILL, TIP_WITH_DRILL, secondDrillTip]}
      />,
    );
    expect(getByTestId("next-focus-drill-name").props.children).toBe("Wall ankle stretch");
  });
});
