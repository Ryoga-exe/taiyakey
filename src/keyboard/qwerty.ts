import type { Key, KeyboardLayout, Point } from "../types";

const KEY_SIZE = 58;
const KEY_GAP = 7;
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const ROW_OFFSETS = [0, 0.5, 1.2];

export function createQwertyLayout(): KeyboardLayout {
  const keys: Key[] = [];

  ROWS.forEach((row, rowIndex) => {
    const y = rowIndex * (KEY_SIZE + KEY_GAP);
    const xOffset = ROW_OFFSETS[rowIndex] * (KEY_SIZE + KEY_GAP);

    [...row].forEach((char, columnIndex) => {
      keys.push({
        id: char,
        chars: [char],
        x: xOffset + columnIndex * (KEY_SIZE + KEY_GAP),
        y,
        width: KEY_SIZE,
        height: KEY_SIZE,
      });
    });
  });

  const charToKey = new Map<string, Key>();
  for (const key of keys) {
    for (const char of key.chars) {
      charToKey.set(char, key);
    }
  }

  const width = Math.max(...keys.map((key) => key.x + key.width));
  const height = Math.max(...keys.map((key) => key.y + key.height));

  return { keys, charToKey, width, height };
}

export function centerOf(key: Key): Point {
  return {
    x: key.x + key.width / 2,
    y: key.y + key.height / 2,
  };
}

export function nearestKey(point: Point, layout: KeyboardLayout): Key {
  let bestKey = layout.keys[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const key of layout.keys) {
    const center = centerOf(key);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    if (distance < bestDistance) {
      bestKey = key;
      bestDistance = distance;
    }
  }

  return bestKey;
}
