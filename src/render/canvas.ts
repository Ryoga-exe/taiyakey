import { centerOf } from "../keyboard/qwerty";
import type { Candidate, KeyboardLayout, Point, WordEntry } from "../types";

type RenderState = {
  layout: KeyboardLayout;
  stroke: Point[];
  normalizedStroke: Point[];
  candidates: Candidate[];
  entriesByWord: Map<string, WordEntry>;
  selectedWord?: string;
  isDrawing: boolean;
};

const PADDING = 16;
const SCALE = 1;

export function canvasSize(layout: KeyboardLayout): { width: number; height: number } {
  return {
    width: Math.ceil(layout.width * SCALE + PADDING * 2),
    height: Math.ceil(layout.height * SCALE + PADDING * 2),
  };
}

export function toCanvasPoint(point: Point): Point {
  return {
    x: point.x * SCALE + PADDING,
    y: point.y * SCALE + PADDING,
    t: point.t,
  };
}

export function fromCanvasPoint(point: Point): Point {
  return {
    x: (point.x - PADDING) / SCALE,
    y: (point.y - PADDING) / SCALE,
    t: point.t,
  };
}

export function render(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const size = canvasSize(state.layout);
  ctx.clearRect(0, 0, size.width, size.height);

  drawBackground(ctx, size.width, size.height);
  drawKeyboard(ctx, state.layout);

  if (state.selectedWord) {
    const entry = state.entriesByWord.get(state.selectedWord);
    if (entry) {
      drawPath(ctx, entry.normalizedPath, "#e36a2e", 4, 0.88);
      drawPoints(ctx, entry.keyPath, "#e36a2e", 4);
    }
  }

  drawPath(ctx, state.normalizedStroke, "#2477d4", 2, 0.5);
  drawPoints(ctx, state.normalizedStroke, "#2477d4", 2);
  drawPath(ctx, state.stroke, "#101828", 4, state.isDrawing ? 0.9 : 0.72);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = "#f6f7f9";
  ctx.fillRect(0, 0, width, height);
}

function drawKeyboard(ctx: CanvasRenderingContext2D, layout: KeyboardLayout): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const key of layout.keys) {
    const x = key.x * SCALE + PADDING;
    const y = key.y * SCALE + PADDING;
    const radius = 8;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d3d8df";
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, key.width * SCALE, key.height * SCALE, radius);
    ctx.fill();
    ctx.stroke();

    const center = toCanvasPoint(centerOf(key));
    drawKeyLabel(ctx, key.chars, center);
  }
}

function drawKeyLabel(
  ctx: CanvasRenderingContext2D,
  chars: string[],
  center: Point,
): void {
  ctx.fillStyle = "#1f2937";

  if (chars.length === 1) {
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillText(chars[0], center.x, center.y);
    return;
  }

  ctx.font = "600 15px system-ui, sans-serif";
  const lineHeight = 20;
  const firstY = center.y - ((chars.length - 1) * lineHeight) / 2;

  chars.forEach((char, index) => {
    ctx.fillText(char, center.x, firstY + index * lineHeight);
  });
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  lineWidth: number,
  alpha: number,
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const first = toCanvasPoint(points[0]);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i += 1) {
    const point = toCanvasPoint(points[i]);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawPoints(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.65;

  for (const point of points) {
    const canvasPoint = toCanvasPoint(point);
    ctx.beginPath();
    ctx.arc(canvasPoint.x, canvasPoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
