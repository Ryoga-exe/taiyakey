import { boundingBox, distance, pathLength } from "../input/resample";
import { centerOf } from "../keyboard/qwerty";
import type { Bounds, KeyboardLayout, Point, WordEntry } from "../types";
import { lengthRatioPenalty } from "./scorer";

export type CandidateFilterOptions = {
  maxStartDistance: number;
  maxEndDistance: number;
  maxLengthRatioDelta: number;
  maxBoundingBoxDistance: number;
  maxCandidatesBeforeScoring: number;
};

export type RecognitionStats = {
  totalEntries: number;
  indexedCandidates: number;
  afterLengthFilter: number;
  afterBoundsFilter: number;
  scoredCandidates: number;
};

export type WordIndex = {
  entries: WordEntry[];
  byStartEndKey: Map<string, WordEntry[]>;
};

export const DEFAULT_FILTER_OPTIONS: CandidateFilterOptions = {
  maxStartDistance: 95,
  maxEndDistance: 95,
  maxLengthRatioDelta: 0.85,
  maxBoundingBoxDistance: 130,
  maxCandidatesBeforeScoring: 600,
};

export function buildWordIndex(entries: WordEntry[]): WordIndex {
  const byStartEndKey = new Map<string, WordEntry[]>();

  for (const entry of entries) {
    const key = startEndKey(entry.startKeyId, entry.endKeyId);
    const bucket = byStartEndKey.get(key) ?? [];
    bucket.push(entry);
    byStartEndKey.set(key, bucket);
  }

  return { entries, byStartEndKey };
}

export function filterCandidates(
  input: Point[],
  index: WordIndex,
  layout: KeyboardLayout,
  options: CandidateFilterOptions = DEFAULT_FILTER_OPTIONS,
): { entries: WordEntry[]; stats: RecognitionStats } {
  if (input.length === 0) {
    return {
      entries: [],
      stats: emptyStats(index.entries.length),
    };
  }

  const startKeys = nearbyKeyIds(input[0], layout, options.maxStartDistance);
  const endKeys = nearbyKeyIds(
    input[input.length - 1],
    layout,
    options.maxEndDistance,
  );
  const indexedCandidates = collectIndexedCandidates(index, startKeys, endKeys);
  const inputPathLength = pathLength(input);
  const inputBounds = boundingBox(input);

  const lengthFiltered = indexedCandidates.filter(
    (entry) =>
      lengthRatioPenalty(inputPathLength, entry.pathLength) <=
      options.maxLengthRatioDelta,
  );
  const boundsFiltered = lengthFiltered.filter(
    (entry) =>
      boundsDistance(inputBounds, entry.bounds) <= options.maxBoundingBoxDistance,
  );
  const scoringPool = chooseScoringPool(
    boundsFiltered,
    lengthFiltered,
    indexedCandidates,
    index.entries,
    Math.max(options.maxCandidatesBeforeScoring, 10),
  );
  const entries = scoringPool
    .sort(
      (a, b) =>
        approximateFilterScore(a, inputPathLength, inputBounds) -
        approximateFilterScore(b, inputPathLength, inputBounds),
    )
    .slice(0, options.maxCandidatesBeforeScoring);

  return {
    entries,
    stats: {
      totalEntries: index.entries.length,
      indexedCandidates: indexedCandidates.length,
      afterLengthFilter: lengthFiltered.length,
      afterBoundsFilter: boundsFiltered.length,
      scoredCandidates: entries.length,
    },
  };
}

function chooseScoringPool(
  boundsFiltered: WordEntry[],
  lengthFiltered: WordEntry[],
  indexedCandidates: WordEntry[],
  allEntries: WordEntry[],
  targetSize: number,
): WordEntry[] {
  const entries = new Map<string, WordEntry>();

  for (const pool of [boundsFiltered, lengthFiltered, indexedCandidates]) {
    for (const entry of pool) {
      entries.set(entry.word, entry);
      if (entries.size >= targetSize) return [...entries.values()];
    }
  }

  if (entries.size > 0) return [...entries.values()];

  for (const entry of allEntries) {
    entries.set(entry.word, entry);
    if (entries.size >= targetSize) return [...entries.values()];
  }

  return [...entries.values()];
}

export function boundsDistance(a: Bounds, b: Bounds): number {
  const centerDistance = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
  const sizeDistance = Math.abs(a.width - b.width) + Math.abs(a.height - b.height);
  return centerDistance + sizeDistance * 0.25;
}

function collectIndexedCandidates(
  index: WordIndex,
  startKeys: string[],
  endKeys: string[],
): WordEntry[] {
  const entries = new Map<string, WordEntry>();

  for (const startKey of startKeys) {
    for (const endKey of endKeys) {
      const bucket = index.byStartEndKey.get(startEndKey(startKey, endKey));
      if (!bucket) continue;
      for (const entry of bucket) {
        entries.set(entry.word, entry);
      }
    }
  }

  return [...entries.values()];
}

function nearbyKeyIds(
  point: Point,
  layout: KeyboardLayout,
  maxDistance: number,
): string[] {
  const nearby = layout.keys
    .map((key) => ({
      id: key.id,
      distance: distance(point, centerOf(key)),
    }))
    .filter((key) => key.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  if (nearby.length > 0) return nearby.map((key) => key.id);

  const nearest = layout.keys
    .map((key) => ({
      id: key.id,
      distance: distance(point, centerOf(key)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest ? [nearest.id] : [];
}

function approximateFilterScore(
  entry: WordEntry,
  inputPathLength: number,
  inputBounds: Bounds,
): number {
  return (
    lengthRatioPenalty(inputPathLength, entry.pathLength) * 100 +
    boundsDistance(inputBounds, entry.bounds) -
    entry.logFrequency * 4
  );
}

function startEndKey(startKeyId: string, endKeyId: string): string {
  return `${startKeyId}:${endKeyId}`;
}

function emptyStats(totalEntries: number): RecognitionStats {
  return {
    totalEntries,
    indexedCandidates: 0,
    afterLengthFilter: 0,
    afterBoundsFilter: 0,
    scoredCandidates: 0,
  };
}
