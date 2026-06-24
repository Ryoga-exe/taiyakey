import { centerOf } from "../keyboard/qwerty";
import { resample } from "../input/resample";
import type { KeyboardLayout, Point, WordEntry } from "../types";

export const NORMALIZED_POINT_COUNT = 64;

export type RawWordEntry = [string, number];

export function collapseRepeats(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

export function buildWordEntry(
  word: string,
  frequency: number,
  layout: KeyboardLayout,
): WordEntry | null {
  const normalizedWord = word.toLowerCase();
  if (!/^[a-z]{2,16}$/.test(normalizedWord)) return null;

  const collapsed = collapseRepeats(normalizedWord);
  const keyPath: Point[] = [];

  for (const char of collapsed) {
    const key = layout.charToKey.get(char);
    if (!key) return null;
    keyPath.push(centerOf(key));
  }

  const firstKey = layout.charToKey.get(collapsed[0]);
  const lastKey = layout.charToKey.get(collapsed[collapsed.length - 1]);
  if (!firstKey || !lastKey) return null;

  return {
    word: normalizedWord,
    frequency,
    logFrequency: Math.log10(Math.max(frequency, 1e-9)),
    collapsed,
    keyPath,
    normalizedPath: resample(keyPath, NORMALIZED_POINT_COUNT),
    startKeyId: firstKey.id,
    endKeyId: lastKey.id,
    length: normalizedWord.length,
  };
}

export function preprocessWords(
  rawWords: RawWordEntry[],
  layout: KeyboardLayout,
): WordEntry[] {
  return rawWords
    .map(([word, frequency]) => buildWordEntry(word, frequency, layout))
    .filter((entry): entry is WordEntry => entry !== null);
}
