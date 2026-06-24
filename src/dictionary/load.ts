import type { KeyboardLayout, WordEntry } from "../types";
import { preprocessWords, type RawWordEntry } from "./preprocess";

export async function loadDictionary(
  url: string,
  layout: KeyboardLayout,
): Promise<WordEntry[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load dictionary: ${response.status}`);
  }

  const rawWords = (await response.json()) as RawWordEntry[];
  return preprocessWords(rawWords, layout);
}
