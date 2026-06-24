import { describe, expect, it } from "vitest";
import { boundingBox, pathLength, resample } from "./resample";

describe("resample", () => {
  it("creates evenly spaced points along a straight path", () => {
    const points = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      6,
    );

    expect(points.map((point) => point.x)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(points.every((point) => point.y === 0)).toBe(true);
  });

  it("duplicates a single point", () => {
    const points = resample([{ x: 4, y: 9 }], 3);

    expect(points).toEqual([
      { x: 4, y: 9 },
      { x: 4, y: 9 },
      { x: 4, y: 9 },
    ]);
  });
});

describe("pathLength", () => {
  it("sums segment lengths", () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 6, y: 8 },
      ]),
    ).toBe(10);
  });
});

describe("boundingBox", () => {
  it("returns extents and center", () => {
    expect(
      boundingBox([
        { x: 3, y: 10 },
        { x: -1, y: 4 },
        { x: 9, y: 7 },
      ]),
    ).toEqual({
      minX: -1,
      minY: 4,
      maxX: 9,
      maxY: 10,
      width: 10,
      height: 6,
      centerX: 4,
      centerY: 7,
    });
  });
});
