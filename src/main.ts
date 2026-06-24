import "./styles.css";
import { preprocessWords, type RawWordEntry } from "./dictionary/preprocess";
import { createQwertyLayout } from "./keyboard/qwerty";
import { fromCanvasPoint, render, canvasSize } from "./render/canvas";
import { recognizeByFullScan } from "./recognizer/recognizer";
import { resample } from "./input/resample";
import type { Candidate, Point, WordEntry } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

app.innerHTML = `
  <main class="app">
    <section class="workspace">
      <div class="topbar">
        <h1 class="title">Taiyakey</h1>
        <div class="status" data-status>Loading dictionary...</div>
      </div>
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
          <h2 class="panel-title">Stroke</h2>
        </div>
        <p class="log" data-log>0 raw points</p>
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
const logEl = requireElement(
  app.querySelector<HTMLParagraphElement>("[data-log]"),
  "Missing log element",
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
let stroke: Point[] = [];
let normalizedStroke: Point[] = [];
let candidates: Candidate[] = [];
let selectedWord: string | undefined;
let isDrawing = false;

void initialize();

async function initialize(): Promise<void> {
  const response = await fetch("/dict/words-1k.json");
  if (!response.ok) {
    throw new Error(`Failed to load dictionary: ${response.status}`);
  }

  const rawWords = (await response.json()) as RawWordEntry[];
  entries = preprocessWords(rawWords, layout);
  entriesByWord = new Map(entries.map((entry) => [entry.word, entry]));

  statusEl.textContent = `${entries.length.toLocaleString()} words ready`;
  draw();
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  isDrawing = true;
  selectedWord = undefined;
  candidates = [];
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
  finishStroke();
});

canvas.addEventListener("pointercancel", () => {
  isDrawing = false;
  draw();
});

function finishStroke(): void {
  isDrawing = false;
  normalizedStroke = resample(stroke, 64);

  if (stroke.length >= 2 && entries.length > 0) {
    const startedAt = performance.now();
    candidates = recognizeByFullScan(stroke, entries, 5);
    selectedWord = candidates[0]?.word;
    const elapsed = performance.now() - startedAt;
    statusEl.textContent = `${entries.length.toLocaleString()} words ready, ${elapsed.toFixed(1)} ms`;
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

  logEl.textContent = `${stroke.length} raw points, ${normalizedStroke.length} normalized points`;
}

function renderCandidates(): void {
  if (candidates.length === 0) {
    candidatesEl.innerHTML = `<div class="empty">Draw across the keyboard to recognize a word.</div>`;
    return;
  }

  candidatesEl.replaceChildren(
    ...candidates.map((candidate) => {
      const button = document.createElement("button");
      button.className =
        candidate.word === selectedWord ? "candidate selected" : "candidate";
      button.type = "button";
      button.addEventListener("click", () => {
        selectedWord = candidate.word;
        renderCandidates();
        draw();
      });

      button.innerHTML = `
        <span class="candidate-word">${candidate.word}</span>
        <span class="candidate-score">${candidate.score.toFixed(1)}</span>
        <span class="candidate-details">
          <span class="metric">path ${candidate.pathDistance.toFixed(1)}</span>
          <span class="metric">start ${candidate.startDistance.toFixed(1)}</span>
          <span class="metric">end ${candidate.endDistance.toFixed(1)}</span>
        </span>
      `;

      return button;
    }),
  );
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
