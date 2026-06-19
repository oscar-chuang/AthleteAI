/**
 * Regression guard: the hidden share-card wrapper View must have
 * `collapsable={false}` so Android's compositor doesn't skip the off-screen
 * view and produce a blank PNG when captureRef is called.
 *
 * Why a source-text test?
 * `collapsable` is an Android-only native prop.  React Native's JS-layer test
 * renderer (used by RNTL) treats `false` as the prop's implicit default and
 * strips it from the rendered instance tree, so UNSAFE_getAllByProps({ collapsable: false })
 * always returns nothing regardless of whether the prop is present in the JSX.
 * Reading the source directly is the only reliable way to pin this prop.
 *
 * A refactor that removes `collapsable={false}` from the wrapper will fail
 * this test and surface the breakage before it ships.
 */

import * as fs from "fs";
import * as path from "path";

const SCREEN_PATH = path.resolve(__dirname, "../[id].tsx");

describe("AnalysisDetailScreen — share card Android compositor flag", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SCREEN_PATH, "utf8");
  });

  it("source contains collapsable={false} on the hidden share-card wrapper", () => {
    // The prop must appear at least once in the file.
    expect(source).toContain("collapsable={false}");
  });

  it("collapsable={false} and shareCardRef appear together in the same View block", () => {
    // Find the line range that contains the hidden share card wrapper.
    // Both `shareCardRef` and `collapsable={false}` must be within 10 lines
    // of each other, confirming they belong to the same element.
    const lines = source.split("\n");
    const refLine = lines.findIndex((l) => l.includes("shareCardRef") && (l.includes("ref=") || l.includes("ref =")));
    const collapsableLine = lines.findIndex((l) => l.includes("collapsable={false}"));

    expect(refLine).toBeGreaterThanOrEqual(0);
    expect(collapsableLine).toBeGreaterThanOrEqual(0);

    const distance = Math.abs(refLine - collapsableLine);
    expect(distance).toBeLessThanOrEqual(10);
  });
});
