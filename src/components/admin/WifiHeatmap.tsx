'use client';

/**
 * WifiHeatmap — canvas-based visualiser for CSI (Channel State Information) data.
 *
 * Renders two sub-views depending on the available data:
 *
 * 1. **Subcarrier Waterfall** (always shown)
 *    Each row = one CSI frame (oldest at top, newest at bottom).
 *    Each column = one subcarrier amplitude value.
 *    Colour = amplitude mapped through a "thermal" heat palette:
 *      0 → deep blue  →  cyan  →  green  →  yellow  →  red → 1
 *
 * 2. **Spatial Dot Overlay** (shown only when estimatedX / estimatedY present)
 *    A small translucent floor-plan overlay with a heat dot centred on the
 *    estimated position of the detected activity.
 *
 * Props:
 *   frames        — array of CsiFrame objects (ordered oldest→newest)
 *   maxRows       — how many rows to display in the waterfall (default 120)
 *   width / height — canvas dimensions in CSS pixels
 *   floorWidth / floorHeight — floor-plan pixel dimensions for spatial overlay
 *   className     — extra Tailwind classes
 */

import { useEffect, useRef, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsiFrame {
  ts: number;
  nodeId: string;
  tableId: string;
  centerId: string;
  csi: number[];
  estimatedX?: number;
  estimatedY?: number;
}

interface Props {
  frames: CsiFrame[];
  /** Number of rows (frames) visible in the waterfall. Default 120. */
  maxRows?: number;
  width?: number;
  height?: number;
  /** Floor-plan dimensions for spatial overlay (optional). */
  floorWidth?: number;
  floorHeight?: number;
  className?: string;
  /** If true, draw a thin green horizontal line at the current playback frame. */
  playbackCursor?: number | null;
}

// ─── Heat palette: 256 pre-computed RGBA values ───────────────────────────────

function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Thermal ramp: blue → cyan → green → yellow → red
    let r = 0, g = 0, b = 0;
    if (t < 0.25) {
      // deep blue → blue
      r = 0; g = 0; b = Math.round(128 + t * 4 * 127);
    } else if (t < 0.5) {
      // blue → cyan
      const s = (t - 0.25) * 4;
      r = 0; g = Math.round(s * 255); b = 255;
    } else if (t < 0.75) {
      // cyan → yellow
      const s = (t - 0.5) * 4;
      r = Math.round(s * 255); g = 255; b = Math.round((1 - s) * 255);
    } else {
      // yellow → red
      const s = (t - 0.75) * 4;
      r = 255; g = Math.round((1 - s) * 255); b = 0;
    }
    palette[i * 4 + 0] = r;
    palette[i * 4 + 1] = g;
    palette[i * 4 + 2] = b;
    palette[i * 4 + 3] = 220; // slight transparency
  }
  return palette;
}

const PALETTE = buildPalette();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a CSI amplitude value to a palette index (0–255). */
function ampToIndex(value: number, min: number, range: number): number {
  if (range === 0) return 0;
  return Math.min(255, Math.max(0, Math.round(((value - min) / range) * 255)));
}

/** Compute global min/max across all frames for normalisation. */
function computeRange(frames: CsiFrame[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const f of frames) {
    for (const v of f.csi) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 1 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WifiHeatmap({
  frames,
  maxRows = 120,
  width = 480,
  height = 320,
  floorWidth,
  floorHeight,
  className = '',
  playbackCursor = null,
}: Props) {
  const waterfallRef = useRef<HTMLCanvasElement>(null);
  const spatialRef = useRef<HTMLCanvasElement>(null);

  // Use only the most recent maxRows frames
  const visibleFrames = useMemo(
    () => frames.slice(-maxRows),
    [frames, maxRows],
  );

  const { min: ampMin, max: ampMax } = useMemo(
    () => computeRange(visibleFrames),
    [visibleFrames],
  );
  const ampRange = ampMax - ampMin;

  // ── Draw waterfall ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waterfallRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Dark background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, W, H);

    if (visibleFrames.length === 0) {
      ctx.fillStyle = 'rgba(6,182,212,0.3)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No CSI data', W / 2, H / 2);
      return;
    }

    const rowH = H / maxRows;
    const numSubcarriers = visibleFrames[0].csi.length || 1;
    const colW = W / numSubcarriers;

    // Render each frame as one horizontal stripe
    const offsetRow = maxRows - visibleFrames.length; // blank rows at top when buffer not full

    for (let row = 0; row < visibleFrames.length; row++) {
      const frame = visibleFrames[row];
      const y = (offsetRow + row) * rowH;

      for (let col = 0; col < frame.csi.length; col++) {
        const idx = ampToIndex(frame.csi[col], ampMin, ampRange);
        const pi = idx * 4;
        ctx.fillStyle = `rgba(${PALETTE[pi]},${PALETTE[pi + 1]},${PALETTE[pi + 2]},${PALETTE[pi + 3] / 255})`;
        ctx.fillRect(col * colW, y, colW + 0.5, rowH + 0.5);
      }
    }

    // Axes hint labels
    ctx.fillStyle = 'rgba(6,182,212,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('← subcarriers →', 4, H - 4);
    ctx.textAlign = 'right';

    // Draw vertical time ticks every 10 rows
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < maxRows; i += 10) {
      const y = i * rowH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Playback cursor
    if (playbackCursor !== null && playbackCursor >= 0) {
      const cursorRow = offsetRow + playbackCursor;
      const cy = cursorRow * rowH;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(W, cy);
      ctx.stroke();
    }

    // Palette legend (right edge, 12px wide)
    for (let i = 0; i < H; i++) {
      const t = 1 - i / H;
      const idx = Math.round(t * 255) * 4;
      ctx.fillStyle = `rgba(${PALETTE[idx]},${PALETTE[idx + 1]},${PALETTE[idx + 2]},1)`;
      ctx.fillRect(W - 12, i, 12, 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 12, 0, 12, H);
  }, [visibleFrames, ampMin, ampRange, maxRows, playbackCursor]);

  // ── Draw spatial overlay ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = spatialRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(10,15,26,0.92)';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(6,182,212,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const fw = floorWidth ?? 800;
    const fh = floorHeight ?? 600;
    const scaleX = W / fw;
    const scaleY = H / fh;

    // Draw the last few frames that have position data
    const positioned = visibleFrames.filter(
      (f) => f.estimatedX !== undefined && f.estimatedY !== undefined,
    );

    for (let i = 0; i < positioned.length; i++) {
      const f = positioned[i];
      const age = positioned.length - i; // 1 = newest
      const alpha = Math.max(0.05, 1 - age / Math.max(positioned.length, 1));
      const cx = (f.estimatedX! * scaleX);
      const cy = (f.estimatedY! * scaleY);
      const radius = 18 + (1 - alpha) * 10;

      // Radial gradient heat dot
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(255,80,0,${alpha * 0.9})`);
      grad.addColorStop(0.5, `rgba(255,200,0,${alpha * 0.4})`);
      grad.addColorStop(1, `rgba(255,200,0,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = 'rgba(6,182,212,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Spatial (AoA)', 4, 14);
    if (positioned.length === 0) {
      ctx.textAlign = 'center';
      ctx.fillText('No position data', W / 2, H / 2);
    }
  }, [visibleFrames, floorWidth, floorHeight]);

  const hasPositional = visibleFrames.some(
    (f) => f.estimatedX !== undefined && f.estimatedY !== undefined,
  );

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Waterfall */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono text-cyan-500/60 uppercase tracking-widest">
          CSI Waterfall
        </span>
        <canvas
          ref={waterfallRef}
          width={width}
          height={height}
          className="rounded border border-cyan-900/40"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Spatial overlay — only render if any position data is available */}
      {hasPositional && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-orange-500/60 uppercase tracking-widest">
            Spatial Heat
          </span>
          <canvas
            ref={spatialRef}
            width={Math.round(width * 0.5)}
            height={height}
            className="rounded border border-orange-900/40"
          />
        </div>
      )}
    </div>
  );
}
