import "./styles.css";
import {
  appendTrialLog,
  clearTrialLogs,
  exportTrialLogs,
  loadTrialLogs,
  updateTrialLogSelection,
} from "./debug/trialLog";
import { preprocessWords, type RawWordEntry } from "./dictionary/preprocess";
import { createQwertyLayout } from "./keyboard/qwerty";
import { Gpt2LanguageClient } from "./language/gpt2Client";
import {
  applyLanguageScores,
  languageModeLabel,
  scoreWithUnigram,
} from "./language/rerank";
import {
  type LanguageMode,
  type LanguageScore,
} from "./language/types";
import { fromCanvasPoint, render, canvasSize } from "./render/canvas";
import {
  recognizeByFullScanResult,
  recognizeWithPruning,
  type RecognitionResult,
} from "./recognizer/recognizer";
import {
  buildWordIndex,
  type RecognitionStats,
  type WordIndex,
} from "./recognizer/filter";
import {
  DEFAULT_SCORE_WEIGHTS,
  type ScoreWeights,
} from "./recognizer/scorer";
import { pathLength, resample } from "./input/resample";
import type {
  Candidate,
  LanguageDiagnostics,
  Point,
  TrialLog,
  WordEntry,
} from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

type DictionaryOption = {
  label: string;
  url: string;
};

type RecognitionMode = "pruned" | "full";

const dictionaries: DictionaryOption[] = [
  { label: "1k", url: "/dict/words-1k.json" },
  { label: "5k", url: "/dict/words-5k.json" },
  { label: "25k", url: "/dict/words-25k.json" },
];
const DISPLAY_CANDIDATE_LIMIT = 5;
const RERANK_CANDIDATE_LIMIT = 24;

app.innerHTML = `
  <main class="app">
    <section class="workspace">
      <div class="topbar">
        <h1 class="title">Taiyakey</h1>
        <div class="status" data-status>Loading dictionary...</div>
      </div>
      <section class="compose-panel">
        <textarea data-composed-text aria-label="Composed text" rows="4"></textarea>
        <div class="compose-actions">
          <button class="secondary-button" type="button" data-undo-word>Undo</button>
          <button class="secondary-button" type="button" data-clear-text>Clear text</button>
        </div>
      </section>
      <div class="canvas-shell">
        <canvas data-keyboard></canvas>
      </div>
    </section>
    <aside class="side">
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Candidates</h2>
        </div>
        <div class="candidate-list" data-candidates>
          <div class="empty">Draw across the keyboard to recognize a word.</div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Recognizer</h2>
        </div>
        <div class="control-list">
          <label class="select-control">
            <span class="control-name">Dictionary</span>
            <select data-dictionary></select>
          </label>
          <label class="select-control">
            <span class="control-name">Mode</span>
            <select data-mode>
              <option value="pruned">Pruned</option>
              <option value="full">Full scan</option>
            </select>
          </label>
          <label class="select-control">
            <span class="control-name">LM</span>
            <select data-language-mode>
              <option value="off">Off</option>
              <option value="unigram">Unigram</option>
              <option value="gpt2">GPT-2</option>
            </select>
          </label>
          <label class="select-control">
            <span class="control-name">LM weight</span>
            <input data-language-weight type="number" min="0" max="20" step="0.1" />
          </label>
          <p class="control-note" data-language-status>LM off</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Weights</h2>
        </div>
        <div class="weight-list" data-weights></div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Stroke</h2>
        </div>
        <p class="log" data-log>0 raw points</p>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Trials</h2>
          <span class="panel-count" data-trial-count>0</span>
        </div>
        <div class="control-list">
          <label class="select-control">
            <span class="control-name">Target</span>
            <input data-target-word type="text" autocomplete="off" />
          </label>
          <div class="button-row">
            <button class="secondary-button" type="button" data-export-logs>Export</button>
            <button class="secondary-button" type="button" data-clear-logs>Clear</button>
          </div>
        </div>
      </section>
    </aside>
  </main>
`;

const canvas = requireElement(
  app.querySelector<HTMLCanvasElement>("[data-keyboard]"),
  "Missing keyboard canvas",
);
const statusEl = requireElement(
  app.querySelector<HTMLDivElement>("[data-status]"),
  "Missing status element",
);
const candidatesEl = requireElement(
  app.querySelector<HTMLDivElement>("[data-candidates]"),
  "Missing candidates element",
);
const weightsEl = requireElement(
  app.querySelector<HTMLDivElement>("[data-weights]"),
  "Missing weights element",
);
const dictionarySelect = requireElement(
  app.querySelector<HTMLSelectElement>("[data-dictionary]"),
  "Missing dictionary select",
);
const modeSelect = requireElement(
  app.querySelector<HTMLSelectElement>("[data-mode]"),
  "Missing mode select",
);
const languageModeSelect = requireElement(
  app.querySelector<HTMLSelectElement>("[data-language-mode]"),
  "Missing language mode select",
);
const languageWeightInput = requireElement(
  app.querySelector<HTMLInputElement>("[data-language-weight]"),
  "Missing language weight input",
);
const languageStatusEl = requireElement(
  app.querySelector<HTMLParagraphElement>("[data-language-status]"),
  "Missing language status element",
);
const logEl = requireElement(
  app.querySelector<HTMLParagraphElement>("[data-log]"),
  "Missing log element",
);
const composedTextEl = requireElement(
  app.querySelector<HTMLTextAreaElement>("[data-composed-text]"),
  "Missing composed text element",
);
const undoWordButton = requireElement(
  app.querySelector<HTMLButtonElement>("[data-undo-word]"),
  "Missing undo word button",
);
const clearTextButton = requireElement(
  app.querySelector<HTMLButtonElement>("[data-clear-text]"),
  "Missing clear text button",
);
const targetWordInput = requireElement(
  app.querySelector<HTMLInputElement>("[data-target-word]"),
  "Missing target word input",
);
const trialCountEl = requireElement(
  app.querySelector<HTMLSpanElement>("[data-trial-count]"),
  "Missing trial count element",
);
const exportLogsButton = requireElement(
  app.querySelector<HTMLButtonElement>("[data-export-logs]"),
  "Missing export logs button",
);
const clearLogsButton = requireElement(
  app.querySelector<HTMLButtonElement>("[data-clear-logs]"),
  "Missing clear logs button",
);

const layout = createQwertyLayout();
const size = canvasSize(layout);
const devicePixelRatio = window.devicePixelRatio || 1;
const ctx = requireCanvasContext(canvas.getContext("2d"));

canvas.width = size.width * devicePixelRatio;
canvas.height = size.height * devicePixelRatio;
canvas.style.setProperty("--canvas-aspect-ratio", `${size.width} / ${size.height}`);
ctx.scale(devicePixelRatio, devicePixelRatio);

let entries: WordEntry[] = [];
let entriesByWord = new Map<string, WordEntry>();
let wordIndex: WordIndex | undefined;
let stroke: Point[] = [];
let normalizedStroke: Point[] = [];
let candidates: Candidate[] = [];
let recognitionStats: RecognitionStats | undefined;
let selectedWord: string | undefined;
let isDrawing = false;
let weights: ScoreWeights = { ...DEFAULT_SCORE_WEIGHTS };
let selectedDictionary = dictionaries[2];
let recognitionMode: RecognitionMode = "pruned";
let currentTrialId: string | undefined;
let composedWords: string[] = [];
let languageMode: LanguageMode = "off";
let languageWeight = 1;
let gpt2Client: Gpt2LanguageClient | undefined;
let languageDiagnostics: LanguageDiagnostics = emptyLanguageDiagnostics();

void initialize();
renderRecognizerControls();
renderWeights();
renderTrialCount();

exportLogsButton.addEventListener("click", () => {
  exportTrialLogs(loadTrialLogs());
});

clearLogsButton.addEventListener("click", () => {
  clearTrialLogs();
  currentTrialId = undefined;
  renderTrialCount();
});

composedTextEl.addEventListener("input", () => {
  composedWords = wordsFromText(composedTextEl.value);
  rerankLastStroke();
});

undoWordButton.addEventListener("click", () => {
  composedWords.pop();
  renderComposedText();
  rerankLastStroke();
});

clearTextButton.addEventListener("click", () => {
  composedWords = [];
  renderComposedText();
  rerankLastStroke();
});

async function initialize(): Promise<void> {
  await loadSelectedDictionary();
}

async function loadSelectedDictionary(): Promise<void> {
  statusEl.textContent = `Loading ${selectedDictionary.label} dictionary...`;
  const response = await fetch(selectedDictionary.url);
  if (!response.ok) {
    throw new Error(`Failed to load dictionary: ${response.status}`);
  }

  const rawWords = (await response.json()) as RawWordEntry[];
  entries = preprocessWords(rawWords, layout);
  entriesByWord = new Map(entries.map((entry) => [entry.word, entry]));
  wordIndex = buildWordIndex(entries);

  statusEl.textContent = `${entries.length.toLocaleString()} words ready`;
  if (stroke.length >= 2) rerankLastStroke();
  draw();
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  isDrawing = true;
  selectedWord = undefined;
  currentTrialId = undefined;
  candidates = [];
  recognitionStats = undefined;
  stroke = [eventPoint(event)];
  normalizedStroke = [];
  renderCandidates();
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawing) return;
  stroke.push(eventPoint(event));
  draw();
});

canvas.addEventListener("pointerup", (event) => {
  if (!isDrawing) return;
  stroke.push(eventPoint(event));
  void finishStroke();
});

canvas.addEventListener("pointercancel", () => {
  isDrawing = false;
  draw();
});

async function finishStroke(): Promise<void> {
  isDrawing = false;
  normalizedStroke = resample(stroke, 64);

  if (stroke.length >= 2 && entries.length > 0 && wordIndex) {
    const startedAt = performance.now();
    const result = await recognizeAndRank(stroke);
    candidates = result.candidates;
    recognitionStats = result.stats;
    selectedWord = candidates[0]?.word;
    const elapsed = performance.now() - startedAt;
    statusEl.textContent = formatStatus(elapsed);
    currentTrialId = saveCurrentTrial();
  }

  renderCandidates();
  draw();
}

function eventPoint(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = size.width / rect.width;
  const scaleY = size.height / rect.height;

  return fromCanvasPoint({
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    t: event.timeStamp,
  });
}

function draw(): void {
  render(ctx, {
    layout,
    stroke,
    normalizedStroke,
    candidates,
    entriesByWord,
    selectedWord,
    isDrawing,
  });

  logEl.textContent = formatStrokeLog();
}

function renderCandidates(): void {
  if (candidates.length === 0) {
    candidatesEl.innerHTML = `<div class="empty">Draw across the keyboard to recognize a word.</div>`;
    return;
  }

  candidatesEl.replaceChildren(
    ...candidates.slice(0, DISPLAY_CANDIDATE_LIMIT).map((candidate) => {
      const button = document.createElement("button");
      button.className =
        candidate.word === selectedWord ? "candidate selected" : "candidate";
      button.type = "button";
      button.addEventListener("click", () => {
        commitCandidate(candidate.word);
      });

      button.innerHTML = `
        <span class="candidate-word">${candidate.word}</span>
        <span class="candidate-score">${candidate.score.toFixed(1)}</span>
        <span class="candidate-details">
          <span class="metric">rank ${candidate.gestureRank}->${candidate.rank}</span>
          <span class="metric">delta ${formatRankDelta(candidate.rankDelta)}</span>
          <span class="metric">gesture ${candidate.gestureScore.toFixed(1)}</span>
          <span class="metric">combined ${candidate.score.toFixed(1)}</span>
          <span class="metric">path ${candidate.pathDistance.toFixed(1)}</span>
          <span class="metric">lm ${candidate.languagePenalty.toFixed(2)}</span>
        </span>
      `;

      return button;
    }),
  );
}

function commitCandidate(word: string): void {
  selectedWord = word;
  composedWords.push(word);
  renderComposedText();

  if (currentTrialId) {
    updateTrialLogSelection(currentTrialId, word);
    renderTrialCount();
  }

  candidates = [];
  stroke = [];
  normalizedStroke = [];
  recognitionStats = undefined;
  currentTrialId = undefined;
  renderCandidates();
  draw();
}

function renderWeights(): void {
  const controls: Array<{
    key: keyof ScoreWeights;
    label: string;
    min: number;
    max: number;
    step: number;
  }> = [
    { key: "startDistance", label: "Start", min: 0, max: 2, step: 0.1 },
    { key: "endDistance", label: "End", min: 0, max: 2, step: 0.1 },
    { key: "frequency", label: "Frequency", min: 0, max: 20, step: 0.5 },
    { key: "lengthPenalty", label: "Length", min: 0, max: 80, step: 1 },
  ];

  weightsEl.replaceChildren(
    ...controls.map((control) => {
      const row = document.createElement("label");
      row.className = "weight-control";

      const name = document.createElement("span");
      name.className = "weight-name";
      name.textContent = control.label;

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(control.min);
      input.max = String(control.max);
      input.step = String(control.step);
      input.value = String(weights[control.key]);
      input.addEventListener("input", () => {
        weights = {
          ...weights,
          [control.key]: Number(input.value),
        };
        value.textContent = formatWeightValue(weights[control.key]);
        rerankLastStroke();
      });

      const value = document.createElement("span");
      value.className = "weight-value";
      value.textContent = formatWeightValue(weights[control.key]);

      row.replaceChildren(name, input, value);
      return row;
    }),
  );
}

function renderRecognizerControls(): void {
  dictionarySelect.replaceChildren(
    ...dictionaries.map((dictionary) => {
      const option = document.createElement("option");
      option.value = dictionary.url;
      option.textContent = dictionary.label;
      option.selected = dictionary.url === selectedDictionary.url;
      return option;
    }),
  );

  dictionarySelect.addEventListener("change", () => {
    const nextDictionary = dictionaries.find(
      (dictionary) => dictionary.url === dictionarySelect.value,
    );
    if (!nextDictionary) return;
    selectedDictionary = nextDictionary;
    void loadSelectedDictionary();
  });

  modeSelect.value = recognitionMode;
  modeSelect.addEventListener("change", () => {
    recognitionMode = modeSelect.value === "full" ? "full" : "pruned";
    rerankLastStroke();
  });

  languageModeSelect.value = languageMode;
  languageModeSelect.addEventListener("change", () => {
    languageMode = parseLanguageMode(languageModeSelect.value);
    renderLanguageStatus();
    rerankLastStroke();
  });

  languageWeightInput.value = String(languageWeight);
  languageWeightInput.addEventListener("input", () => {
    languageWeight = Number(languageWeightInput.value);
    rerankLastStroke();
  });

  renderLanguageStatus();
}

function rerankLastStroke(): void {
  if (stroke.length < 2 || entries.length === 0 || !wordIndex || isDrawing) return;

  void rerankLastStrokeAsync();
}

async function rerankLastStrokeAsync(): Promise<void> {
  const startedAt = performance.now();
  const result = await recognizeAndRank(stroke);
  candidates = result.candidates;
  recognitionStats = result.stats;
  selectedWord = candidates[0]?.word;
  const elapsed = performance.now() - startedAt;
  statusEl.textContent = formatStatus(elapsed);
  renderCandidates();
  draw();
}

function recognize(input: Point[], limit: number): RecognitionResult {
  if (!wordIndex) {
    return {
      candidates: [],
      stats: {
        totalEntries: entries.length,
        indexedCandidates: 0,
        afterLengthFilter: 0,
        afterBoundsFilter: 0,
        scoredCandidates: 0,
      },
    };
  }

  if (recognitionMode === "full") {
    return recognizeByFullScanResult(input, entries, limit, weights);
  }

  return recognizeWithPruning(input, wordIndex, layout, limit, weights);
}

async function recognizeAndRank(input: Point[]): Promise<RecognitionResult> {
  const result = recognize(input, RERANK_CANDIDATE_LIMIT);
  const rankedCandidates = await rerankWithLanguage(result.candidates);

  return {
    ...result,
    candidates: rankedCandidates,
  };
}

async function rerankWithLanguage(rawCandidates: Candidate[]): Promise<Candidate[]> {
  const startedAt = performance.now();

  if (languageMode === "off") {
    languageDiagnostics = {
      mode: languageMode,
      model: "off",
      weight: languageWeight,
      rerankedCandidates: rawCandidates.length,
      elapsedMs: performance.now() - startedAt,
      status: "off",
    };
    renderLanguageStatus();
    return applyLanguageScores(rawCandidates, [], 0);
  }

  const context = composedText();
  let languageScores: LanguageScore[] = [];
  let status = "ready";

  if (languageMode === "unigram") {
    languageScores = scoreWithUnigram(rawCandidates, entriesByWord);
  } else {
    languageScores = await scoreWithGpt2(context, rawCandidates);
    status = gpt2Client?.status ?? "ready";
  }

  languageDiagnostics = {
    mode: languageMode,
    model: languageMode === "gpt2" ? "Xenova/distilgpt2" : "wordfreq-unigram",
    weight: languageWeight,
    rerankedCandidates: languageScores.length,
    elapsedMs: performance.now() - startedAt,
    status,
  };

  renderLanguageStatus();
  return applyLanguageScores(rawCandidates, languageScores, languageWeight);
}

async function scoreWithGpt2(
  context: string,
  rawCandidates: Candidate[],
): Promise<LanguageScore[]> {
  try {
    gpt2Client ??= new Gpt2LanguageClient();
    renderLanguageStatus("Loading/scoring GPT-2...");
    const scores = await gpt2Client.scoreCandidates(
      context,
      rawCandidates.slice(0, DISPLAY_CANDIDATE_LIMIT * 2),
    );
    renderLanguageStatus(gpt2Client.message);
    return scores;
  } catch (error) {
    renderLanguageStatus(error instanceof Error ? error.message : String(error));
    return [];
  }
}

function formatStatus(elapsed: number): string {
  const scored = recognitionStats?.scoredCandidates ?? entries.length;
  return `${selectedDictionary.label} ${recognitionMode}, ${languageModeLabel(languageMode)}, ${entries.length.toLocaleString()} words, scored ${scored.toLocaleString()}, ${elapsed.toFixed(1)} ms`;
}

function formatStrokeLog(): string {
  const base = `${stroke.length} raw points, ${normalizedStroke.length} normalized points, ${pathLength(stroke).toFixed(0)}px path`;
  const lm = `lm ${languageDiagnostics.rerankedCandidates} in ${languageDiagnostics.elapsedMs.toFixed(1)}ms`;
  if (!recognitionStats) return `${base}. ${lm}`;

  return `${base}. indexed ${recognitionStats.indexedCandidates}, length ${recognitionStats.afterLengthFilter}, bbox ${recognitionStats.afterBoundsFilter}, scored ${recognitionStats.scoredCandidates}, ${lm}`;
}

function saveCurrentTrial(): string {
  const id = crypto.randomUUID();
  const targetWord = normalizeOptionalWord(targetWordInput.value);
  const log: TrialLog = {
    id,
    targetWord,
    stroke,
    normalizedStroke,
    candidates,
    recognizerVersion: "m4-local-log-v1",
    dictionaryVersion: selectedDictionary.label,
    timestamp: Date.now(),
    recognitionMode,
    textBefore: composedText(),
    committedWord: selectedWord,
    languageMode,
    languageWeight,
    languageDiagnostics,
    weights,
    stats: recognitionStats ? { ...recognitionStats } : undefined,
  };

  appendTrialLog(log);
  renderTrialCount();
  return id;
}

function renderTrialCount(): void {
  trialCountEl.textContent = String(loadTrialLogs().length);
}

function normalizeOptionalWord(value: string): string | undefined {
  const word = value.trim().toLowerCase();
  return word.length > 0 ? word : undefined;
}

function renderComposedText(): void {
  composedTextEl.value = composedText();
}

function composedText(): string {
  return composedWords.join(" ");
}

function parseLanguageMode(value: string): LanguageMode {
  if (value === "unigram" || value === "gpt2") return value;
  return "off";
}

function wordsFromText(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function renderLanguageStatus(message?: string): void {
  if (message) {
    languageStatusEl.textContent = message;
    return;
  }

  if (languageMode === "off") {
    languageStatusEl.textContent = "LM off";
    return;
  }

  if (languageMode === "unigram") {
    languageStatusEl.textContent = `Unigram LM, ${languageDiagnostics.rerankedCandidates} candidates, ${languageDiagnostics.elapsedMs.toFixed(1)} ms`;
    return;
  }

  const base = gpt2Client?.message ?? "GPT-2 not loaded";
  languageStatusEl.textContent = `${base}, ${languageDiagnostics.rerankedCandidates} candidates, ${languageDiagnostics.elapsedMs.toFixed(1)} ms`;
}

function formatRankDelta(rankDelta: number): string {
  if (rankDelta > 0) return `+${rankDelta}`;
  return String(rankDelta);
}

function emptyLanguageDiagnostics(): LanguageDiagnostics {
  return {
    mode: "off",
    model: "off",
    weight: 0,
    rerankedCandidates: 0,
    elapsedMs: 0,
    status: "idle",
  };
}

function formatWeightValue(value: number): string {
  return value.toFixed(Number.isInteger(value) ? 0 : 1);
}

function requireElement<T extends Element>(
  element: T | null,
  message: string,
): T {
  if (!element) throw new Error(message);
  return element;
}

function requireCanvasContext(
  context: CanvasRenderingContext2D | null,
): CanvasRenderingContext2D {
  if (!context) throw new Error("Canvas 2D context is not available");
  return context;
}
