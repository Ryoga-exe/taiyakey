import { describe, expect, it } from "vitest";
import { createQwertyLayout } from "../keyboard/qwerty";
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

  it("rejects unsupported words", () => {
    expect(buildWordEntry("don't", 0.2, createQwertyLayout())).toBeNull();
    expect(buildWordEntry("supercalifragilisticexpialidocious", 0.2, createQwertyLayout())).toBeNull();
  });
});
