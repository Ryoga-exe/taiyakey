export type Point = {
  x: number;
  y: number;
  t?: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
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
  id: string;
  label: string;
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
  pathLength: number;
  bounds: Bounds;
  startKeyId: string;
  endKeyId: string;
  length: number;
};

export type Candidate = {
  word: string;
  rank: number;
  gestureRank: number;
  rankDelta: number;
  score: number;
  gestureScore: number;
  pathDistance: number;
  startDistance: number;
  endDistance: number;
  lengthPenalty: number;
  inputPathLength: number;
  wordPathLength: number;
  frequencyBonus: number;
  languagePenalty: number;
  languageModel: string;
};

export type LanguageDiagnostics = {
  mode: string;
  model: string;
  weight: number;
  rerankedCandidates: number;
  elapsedMs: number;
  status: string;
};

export type TrialLog = {
  id: string;
  targetWord?: string;
  stroke: Point[];
  normalizedStroke: Point[];
  candidates: Candidate[];
  selectedWord?: string;
  recognizerVersion: string;
  dictionaryVersion: string;
  keyboardLayout?: string;
  timestamp: number;
  recognitionMode: string;
  textBefore?: string;
  committedWord?: string;
  languageMode?: string;
  languageWeight?: number;
  languageDiagnostics?: LanguageDiagnostics;
  weights: Record<string, number>;
  stats?: Record<string, number>;
};
