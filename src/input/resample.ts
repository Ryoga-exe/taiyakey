import type { Bounds, Point } from "../types";

export function pathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

export function boundingBox(points: Point[]): Bounds {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

export function resample(points: Point[], count: number): Point[] {
  if (count <= 0) return [];
  if (points.length === 0) return [];
  if (points.length === 1 || pathLength(points) === 0) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  const totalLength = pathLength(points);
  const interval = totalLength / (count - 1);
  const result: Point[] = [{ ...points[0] }];

  let segmentStart = points[0];
  let segmentIndex = 1;
  let remainingDistance = interval;

  while (segmentIndex < points.length && result.length < count - 1) {
    const segmentEnd = points[segmentIndex];
    const segmentLength = distance(segmentStart, segmentEnd);

    if (segmentLength >= remainingDistance) {
      const ratio = remainingDistance / segmentLength;
      const point = interpolate(segmentStart, segmentEnd, ratio);
      result.push(point);
      segmentStart = point;
      remainingDistance = interval;
    } else {
      remainingDistance -= segmentLength;
      segmentStart = segmentEnd;
      segmentIndex += 1;
    }
  }

  result.push({ ...points[points.length - 1] });

  while (result.length < count) {
    result.push({ ...points[points.length - 1] });
  }

  return result;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function interpolate(a: Point, b: Point, ratio: number): Point {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    t:
      a.t === undefined || b.t === undefined
        ? undefined
        : a.t + (b.t - a.t) * ratio,
  };
}
