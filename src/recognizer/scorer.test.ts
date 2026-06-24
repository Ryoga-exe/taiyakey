import { describe, expect, it } from "vitest";
import type { WordEntry } from "../types";
import { lengthRatioPenalty, scoreEntry } from "./scorer";

describe("lengthRatioPenalty", () => {
  it("returns zero for equal path lengths", () => {
    expect(lengthRatioPenalty(120, 120)).toBe(0);
  });

  it("returns a ratio delta for mismatched path lengths", () => {
    expect(lengthRatioPenalty(200, 100)).toBe(1);
    expect(lengthRatioPenalty(100, 200)).toBe(1);
  });
});

describe("scoreEntry", () => {
  it("reports the M2 score breakdown", () => {
    const entry: WordEntry = {
      word: "test",
      frequency: 4,
      logFrequency: 4,
      collapsed: "test",
      keyPath: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      normalizedPath: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      pathLength: 100,
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 0,
        width: 100,
        height: 0,
        centerX: 50,
        centerY: 0,
      },
      startKeyId: "t",
      endKeyId: "t",
      length: 4,
    };

    const candidate = scoreEntry(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      entry,
      200,
    );

    expect(candidate.pathDistance).toBe(50);
    expect(candidate.startDistance).toBe(0);
    expect(candidate.endDistance).toBe(100);
    expect(candidate.lengthPenalty).toBe(1);
    expect(candidate.inputPathLength).toBe(200);
    expect(candidate.wordPathLength).toBe(100);
    expect(candidate.frequencyBonus).toBe(-32);
    expect(candidate.score).toBe(candidate.gestureScore);
    expect(candidate.languagePenalty).toBe(0);
  });
});
