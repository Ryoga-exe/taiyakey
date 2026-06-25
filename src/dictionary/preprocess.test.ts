import { describe, expect, it } from "vitest";
import { createColumnQwertyLayout, createQwertyLayout } from "../keyboard/qwerty";
import { buildWordEntry, collapseRepeats } from "./preprocess";

describe("collapseRepeats", () => {
  it("removes adjacent duplicate letters", () => {
    expect(collapseRepeats("hello")).toBe("helo");
    expect(collapseRepeats("letter")).toBe("leter");
    expect(collapseRepeats("book")).toBe("bok");
  });
});

describe("buildWordEntry", () => {
  it("keeps the display word while using the collapsed path", () => {
    const entry = buildWordEntry("hello", 0.2, createQwertyLayout());

    expect(entry?.word).toBe("hello");
    expect(entry?.collapsed).toBe("helo");
    expect(entry?.normalizedPath).toHaveLength(64);
  });

  it("supports one-letter words such as i and a", () => {
    const layout = createQwertyLayout();

    expect(buildWordEntry("i", 7, layout)?.word).toBe("i");
    expect(buildWordEntry("a", 7, layout)?.word).toBe("a");
  });

  it("rejects unsupported words", () => {
    expect(buildWordEntry("don't", 0.2, createQwertyLayout())).toBeNull();
    expect(buildWordEntry("supercalifragilisticexpialidocious", 0.2, createQwertyLayout())).toBeNull();
  });

  it("collapses adjacent letters that share a column key", () => {
    const entry = buildWordEntry("qaz", 0.2, createColumnQwertyLayout());

    expect(entry?.collapsed).toBe("qaz");
    expect(entry?.keyPath).toHaveLength(1);
    expect(entry?.startKeyId).toBe("c0");
    expect(entry?.endKeyId).toBe("c0");
  });
});
