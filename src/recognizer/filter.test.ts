import { describe, expect, it } from "vitest";
import { buildWordEntry } from "../dictionary/preprocess";
import { createQwertyLayout } from "../keyboard/qwerty";
import { buildWordIndex, filterCandidates } from "./filter";

describe("filterCandidates", () => {
  it("uses start/end key index before detailed scoring", () => {
    const layout = createQwertyLayout();
    const words = ["hello", "world", "test", "go", "keyboard"];
    const entries = words
      .map((word, index) => buildWordEntry(word, 1 / (index + 1), layout))
      .filter((entry) => entry !== null);
    const index = buildWordIndex(entries);
    const hello = entries.find((entry) => entry.word === "hello");

    expect(hello).toBeDefined();

    const result = filterCandidates(hello!.keyPath, index, layout);

    expect(result.stats.totalEntries).toBe(entries.length);
    expect(result.stats.indexedCandidates).toBeLessThan(entries.length);
    expect(result.entries.some((entry) => entry.word === "hello")).toBe(true);
  });
});
