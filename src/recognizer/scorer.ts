import { distance } from "../input/resample";
import type { Candidate, Point, WordEntry } from "../types";

export type ScoreWeights = {
  startDistance: number;
  endDistance: number;
  frequency: number;
  lengthPenalty: number;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  startDistance: 0.8,
  endDistance: 0.8,
  frequency: 8,
  lengthPenalty: 32,
};

export function scoreEntry(
  normalizedInput: Point[],
  entry: WordEntry,
  inputPathLength: number,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): Candidate {
  const pathDistanceValue = pathDistance(normalizedInput, entry.normalizedPath);
  const startDistanceValue = distance(normalizedInput[0], entry.normalizedPath[0]);
  const endDistanceValue = distance(
    normalizedInput[normalizedInput.length - 1],
    entry.normalizedPath[entry.normalizedPath.length - 1],
  );
  const lengthPenalty = lengthRatioPenalty(inputPathLength, entry.pathLength);
  const frequencyBonus = -weights.frequency * entry.logFrequency;

  const gestureScore =
      pathDistanceValue +
      weights.startDistance * startDistanceValue +
      weights.endDistance * endDistanceValue +
      weights.lengthPenalty * lengthPenalty +
      frequencyBonus;

  return {
    word: entry.word,
    rank: 0,
    gestureRank: 0,
    rankDelta: 0,
    score: gestureScore,
    gestureScore,
    pathDistance: pathDistanceValue,
    startDistance: startDistanceValue,
    endDistance: endDistanceValue,
    lengthPenalty,
    inputPathLength,
    wordPathLength: entry.pathLength,
    frequencyBonus,
    languagePenalty: 0,
    languageModel: "off",
  };
}

export function lengthRatioPenalty(inputPathLength: number, wordPathLength: number): number {
  if (inputPathLength <= 0 && wordPathLength <= 0) return 0;
  const longer = Math.max(inputPathLength, wordPathLength);
  const shorter = Math.max(Math.min(inputPathLength, wordPathLength), 1);
  return longer / shorter - 1;
}

export function pathDistance(a: Point[], b: Point[]): number {
  const count = Math.min(a.length, b.length);
  if (count === 0) return Number.POSITIVE_INFINITY;

  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    sum += distance(a[i], b[i]);
  }

  return sum / count;
}
