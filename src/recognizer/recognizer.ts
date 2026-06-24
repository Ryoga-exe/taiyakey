import { resample } from "../input/resample";
import { NORMALIZED_POINT_COUNT } from "../dictionary/preprocess";
import type { Candidate, Point, WordEntry } from "../types";
import { scoreEntry, type ScoreWeights } from "./scorer";

export function recognizeByFullScan(
  input: Point[],
  entries: WordEntry[],
  limit = 5,
  weights?: ScoreWeights,
): Candidate[] {
  const normalizedInput = resample(input, NORMALIZED_POINT_COUNT);

  return entries
    .map((entry) => scoreEntry(normalizedInput, entry, weights))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
