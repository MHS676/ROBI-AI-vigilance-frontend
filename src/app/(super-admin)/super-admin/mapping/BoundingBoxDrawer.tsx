'use client';

/**
 * BoundingBoxDrawer — react-konva canvas for drawing table zones.
 *
 * Loaded via dynamic import (ssr:false) because Konva accesses
 * `document` at module level and cannot run on the server.
 *
 * UX:
 *  - Generated dark "surveillance camera" placeholder as the background
 *  - Crosshair cursor; click+drag draws a cyan dashed rectangle
 *  - Corner handles + dimension label show while drawing / after drawn
 *  - Minimum box = 10×10 px (ignores accidental clicks)
 *  - onBoxDrawn fires with normalized (0-1) coordinates
 *  - "Clear" button resets the box
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage, Text } from 'react-konva';
import { RotateCcw } from 'lucide-react';

// ─── Public types ─────────────────────────────────────────────────────────────
/** Pixel coordinates relative to the Stage canvas */
export interface BBoxPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalized coordinates (0-1) independent of canvas resolution */
export interface BBoxNorm {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  stageW: number;
  stageH: number;
  cameraName: string;
  cameraIp?: string;
  /** Seed with an existing box (in normalized coords) to show a pre-drawn zone */
  existingBox?: BBoxNorm | null;
  /** Called once the user finishes drawing (mouse up) */
  onBoxDrawn: (norm: BBoxNorm, px: BBoxPx) => void;
  /** Called when the clear button is clicked */
  onClear: () => void;
}

// ─── Placeholder background builder ──────────────────────────────────────────
function buildPlaceholder(w: number, h: number, name: string): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(1, '#0b0f1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle surveillance grid
  ctx.strokeStyle = 'rgba(6,182,212,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Scanline effect (every 2px horizontal band)
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }

  // Corner bracket markers
  const pad = 18;
  const arm = 22;
  ctx.strokeStyle = 'rgba(6,182,212,0.3)';
  ctx.lineWidth = 2;
  const corners: [number, number, number, number][] = [
    [pad, pad, 1, 1], [w - pad, pad, -1, 1],
    [pad, h - pad, 1, -1], [w - pad, h - pad, -1, -1],
  ];
  corners.forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * arm);
    ctx.stroke();
  });

  // REC indicator (top-left)
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(pad + 10, pad + 10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(248,113,113,0.7)';
  ctx.font = '500 10px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('REC', pad + 18, pad + 14);

  // Camera name watermark
  ctx.fillStyle = 'rgba(6,182,212,0.5)';
  ctx.font = '600 12px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`\u{1F4F7}  ${name}`, pad + 2, h - pad - 6);

  // Center instruction text
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click and drag to draw a bounding box', w / 2, h / 2 - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('over the physical table in the camera frame', w / 2, h / 2 + 12);

  const img = new window.Image();
  img.src = canvas.toDataURL();
  return img;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BoundingBoxDrawer({
  stageW,
  stageH,
  cameraName,
  existingBox,
  onBoxDrawn,
  onClear,
}: Props) {
  const [bgImage, setBgImage]   = useState<HTMLImageElement | null>(null);
  const [isDrawing, setDrawing]  = useState(false);
  const startRef = useRef({ x: 0, y: 0 });

  // Active box in pixel coords
  const [box, setBox] = useState<BBoxPx | null>(() =>
    existingBox
      ? {
          x: existingBox.x * stageW,
          y: existingBox.y * stageH,
          width:  existingBox.width  * stageW,
          height: existingBox.height * stageH,
        }
      : null,
  );

  // Generate placeholder on mount / when camera changes
  useEffect(() => {
    const img = buildPlaceholder(stageW, stageH, cameraName);
    img.onload = () => setBgImage(img);
    // If already loaded (data URL) trigger immediately
    if (img.complete) setBgImage(img);
  }, [stageW, stageH, cameraName]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = (e: any) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setDrawing(true);
    startRef.current = pos;
    setBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const sx = startRef.current.x;
    const sy = startRef.current.y;
    setBox({
      x: Math.min(sx, pos.x),
      y: Math.min(sy, pos.y),
      width:  Math.abs(pos.x - sx),
      height: Math.abs(pos.y - sy),
    });
  };

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !box) return;
    setDrawing(false);
    if (box.width < 10 || box.height < 10) {
      setBox(null);
      return;
    }
    const norm: BBoxNorm = {
      x:      box.x      / stageW,
      y:      box.y      / stageH,
      width:  box.width  / stageW,
      height: box.height / stageH,
    };
    onBoxDrawn(norm, box);
  }, [isDrawing, box, stageW, stageH, onBoxDrawn]);

  // Also fire mouseup when pointer leaves the stage
  const handleMouseLeave = handleMouseUp;

  const handleClear = () => {
    setBox(null);
    onClear();
  };

  // ── Corner handle positions ──────────────────────────────────────────────────
  const corners = box
    ? [
        [box.x,              box.y             ],
        [box.x + box.width,  box.y             ],
        [box.x,              box.y + box.height],
        [box.x + box.width,  box.y + box.height],
      ]
    : [];

  return (
    <div className="relative select-none">
      {/* Konva Stage */}
      <Stage
        width={stageW}
        height={stageH}
        style={{
          cursor: 'crosshair',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'block',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <Layer>
          {/* Placeholder background */}
          {bgImage && (
            <KonvaImage
              image={bgImage}
              x={0} y={0}
              width={stageW}
              height={stageH}
            />
          )}

          {/* Drawn bounding box */}
          {box && box.width > 2 && (
            <>
              {/* Semi-transparent fill */}
              <Rect
                x={box.x} y={box.y}
                width={box.width} height={box.height}
                fill="rgba(6,182,212,0.12)"
                stroke="#06b6d4"
                strokeWidth={2}
                dash={[8, 5]}
                shadowColor="#06b6d4"
                shadowBlur={8}
                shadowOpacity={0.4}
              />

              {/* Dimension label */}
              <Text
                x={box.x + 6}
                y={box.y + 6}
                text={`${Math.round(box.width)} × ${Math.round(box.height)} px`}
                fontSize={11}
                fontStyle="bold"
                fill="#22d3ee"
                padding={2}
              />

              {/* Corner handles */}
              {corners.map(([cx, cy], i) => (
                <Rect
                  key={i}
                  x={cx - 5} y={cy - 5}
                  width={10} height={10}
                  fill="#06b6d4"
                  cornerRadius={2}
                  shadowColor="#06b6d4"
                  shadowBlur={4}
                  shadowOpacity={0.8}
                />
              ))}

              {/* Normalized coordinate readout */}
              <Text
                x={box.x + 6}
                y={box.y + box.height - 20}
                text={`x:${(box.x / stageW).toFixed(3)}  y:${(box.y / stageH).toFixed(3)}  w:${(box.width / stageW).toFixed(3)}  h:${(box.height / stageH).toFixed(3)}`}
                fontSize={9}
                fill="rgba(34,211,238,0.6)"
                padding={2}
              />
            </>
          )}
        </Layer>
      </Stage>

      {/* Clear button — shown when a box is drawn */}
      {box && (
        <button
          onClick={handleClear}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 hover:text-white hover:border-red-500/40 hover:bg-red-500/10 transition-all backdrop-blur-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Clear box
        </button>
      )}
    </div>
  );
}
