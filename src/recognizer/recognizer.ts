import { pathLength, resample } from "../input/resample";
import { NORMALIZED_POINT_COUNT } from "../dictionary/preprocess";
import type { Candidate, KeyboardLayout, Point, WordEntry } from "../types";
import {
  filterCandidates,
  type RecognitionStats,
  type WordIndex,
} from "./filter";
import { scoreEntry, type ScoreWeights } from "./scorer";

export type RecognitionResult = {
  candidates: Candidate[];
  stats: RecognitionStats;
};

export function recognizeByFullScan(
  input: Point[],
  entries: WordEntry[],
  limit = 5,
  weights?: ScoreWeights,
): Candidate[] {
  const normalizedInput = resample(input, NORMALIZED_POINT_COUNT);
  const inputPathLength = pathLength(input);

  return entries
    .map((entry) => scoreEntry(normalizedInput, entry, inputPathLength, weights))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function recognizeByFullScanResult(
  input: Point[],
  entries: WordEntry[],
  limit = 5,
  weights?: ScoreWeights,
): RecognitionResult {
  const candidates = recognizeByFullScan(input, entries, limit, weights);

  return {
    candidates,
    stats: {
      totalEntries: entries.length,
      indexedCandidates: entries.length,
      afterLengthFilter: entries.length,
      afterBoundsFilter: entries.length,
      scoredCandidates: entries.length,
    },
  };
}

export function recognizeWithPruning(
  input: Point[],
  index: WordIndex,
  layout: KeyboardLayout,
  limit = 5,
  weights?: ScoreWeights,
): RecognitionResult {
  const normalizedInput = resample(input, NORMALIZED_POINT_COUNT);
  const inputPathLength = pathLength(input);
  const filtered = filterCandidates(input, index, layout);

  const candidates = filtered.entries
    .map((entry) => scoreEntry(normalizedInput, entry, inputPathLength, weights))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return {
    candidates,
    stats: filtered.stats,
  };
}
