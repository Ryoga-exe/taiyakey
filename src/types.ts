export type Point = {
  x: number;
  y: number;
  t?: number;
};

export type Key = {
  id: string;
  chars: string[];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KeyboardLayout = {
  keys: Key[];
  charToKey: Map<string, Key>;
  width: number;
  height: number;
};

export type WordEntry = {
  word: string;
  frequency: number;
  logFrequency: number;
  collapsed: string;
  keyPath: Point[];
  normalizedPath: Point[];
  startKeyId: string;
  endKeyId: string;
  length: number;
};

export type Candidate = {
  word: string;
  score: number;
  pathDistance: number;
  startDistance: number;
  endDistance: number;
  lengthPenalty: number;
  frequencyBonus: number;
};
