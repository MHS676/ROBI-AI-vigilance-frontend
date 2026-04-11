'use client';

/**
 * MappingPageClient — full Hardware Mapping UI orchestrator.
 *
 * Flow:
 *   Step 1 → Select a Center
 *   Step 2 → Select a Camera (filtered by chosen center)
 *   Step 3 → Draw a bounding box on the camera placeholder canvas
 *   Drawer → Link the zone to a Table, Microphone, and Agent
 *
 * Live AI Overlays (Enterprise Edition):
 *   - Fall detected    → pulsing skeleton icon (🦴) over canvas + red border flash
 *   - Audio alert      → concentric soundwave ripple animation at bottom of canvas
 *   - Weapon detected  → orange WARNING stripe across canvas
 *   - Crowd detected   → amber crowd icon pulse
 *   - Fire detected    → orange/red flame flicker overlay
 *   All overlays auto-clear after 8 seconds or on camera change.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Map,
  Building2,
  Camera as CameraIcon,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Bot,
  ShieldAlert,
  Volume2,
  PersonStanding,
  Flame,
  Users,
} from 'lucide-react';
import { centersApi } from '@/lib/api';
import type { Center, Camera, WsEventEnvelope } from '@/types';
import type { BBoxNorm } from './BoundingBoxDrawer';
import LinkTableDrawer from './LinkTableDrawer';
import AiSettingsModal from './AiSettingsModal';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';

// ─── Live AI overlay types ────────────────────────────────────────────────────
type OverlayKind = 'fall' | 'audio' | 'weapon' | 'crowd' | 'fire';

interface ActiveOverlay {
  id: string;
  kind: OverlayKind;
  label: string;
  centerId: string;
  /** ms timestamp when this overlay expires */
  expiresAt: number;
}

const OVERLAY_TTL_MS = 8_000; // overlays auto-clear after 8 s

// ─── Map WS event → overlay kind ─────────────────────────────────────────────
const EVENT_TO_OVERLAY: Partial<Record<string, OverlayKind>> = {
  'alert:fall_detected':       'fall',
  'alert:sick_detected':       'fall',
  'alert:high_audio_level':    'audio',
  'alert:vandalism_detected':  'audio',
  'alert:irate_customer':      'audio',
  'alert:weapon_detected':     'weapon',
  'alert:aggression_detected': 'weapon',
  'alert:crowd_detected':      'crowd',
  'alert:long_stay':           'crowd',
  'alert:fire_detected':       'fire',
};

const OVERLAY_EVENTS = Object.keys(EVENT_TO_OVERLAY);

// ─── Overlay event labels ─────────────────────────────────────────────────────
const OVERLAY_META: Record<OverlayKind, { label: string; color: string; borderColor: string }> = {
  fall:   { label: 'FALL / SICK DETECTED',    color: 'bg-red-500/20',     borderColor: 'border-red-500'    },
  audio:  { label: 'AUDIO ALERT',             color: 'bg-amber-500/15',   borderColor: 'border-amber-500'  },
  weapon: { label: 'WEAPON / AGGRESSION',     color: 'bg-orange-500/25',  borderColor: 'border-orange-500' },
  crowd:  { label: 'CROWD / LONG STAY',       color: 'bg-yellow-500/15',  borderColor: 'border-yellow-400' },
  fire:   { label: 'FIRE / SMOKE DETECTED',   color: 'bg-orange-600/25',  borderColor: 'border-orange-600' },
};

// ─── Individual overlay component ────────────────────────────────────────────
function CanvasOverlay({
  overlays,
  stageW,
  stageH,
}: {
  overlays: ActiveOverlay[];
  stageW: number;
  stageH: number;
}) {
  if (overlays.length === 0) return null;

  // Show the highest-priority overlay (weapon > fire > fall > audio > crowd)
  const PRIORITY: OverlayKind[] = ['weapon', 'fire', 'fall', 'audio', 'crowd'];
  const topKind = PRIORITY.find((k) => overlays.some((o) => o.kind === k)) ?? overlays[0].kind;
  const meta    = OVERLAY_META[topKind];

  return (
    <div
      className={cn(
        'absolute inset-0 rounded-xl border-2 pointer-events-none overflow-hidden transition-all',
        meta.color,
        meta.borderColor,
      )}
      style={{ width: stageW, height: stageH }}
    >
      {/* Animated border pulse */}
      <div className={cn('absolute inset-0 rounded-xl border-2 animate-ping opacity-40', meta.borderColor)} />

      {/* Alert label banner */}
      <div className={cn(
        'absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2',
        'px-4 py-2 rounded-full backdrop-blur-md bg-slate-900/70 border text-xs font-bold tracking-widest animate-pulse',
        meta.borderColor,
      )}>
        <OverlayIcon kind={topKind} />
        <span className="text-white">{meta.label}</span>
      </div>

      {/* Kind-specific animation */}
      {topKind === 'fall'   && <FallSkeleton stageW={stageW} stageH={stageH} />}
      {topKind === 'audio'  && <SoundwaveRipple stageW={stageW} stageH={stageH} />}
      {topKind === 'fire'   && <FireFlicker stageW={stageW} stageH={stageH} />}
      {topKind === 'crowd'  && <CrowdPulse stageW={stageW} stageH={stageH} />}
      {topKind === 'weapon' && <WeaponStripe stageW={stageW} stageH={stageH} />}

      {/* Active alerts badge strip (bottom) */}
      {overlays.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {overlays.map((o) => (
            <span key={o.id} className="px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300">
              {OVERLAY_META[o.kind].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OverlayIcon({ kind }: { kind: OverlayKind }) {
  switch (kind) {
    case 'fall':   return <PersonStanding className="w-3.5 h-3.5 text-red-400" />;
    case 'audio':  return <Volume2         className="w-3.5 h-3.5 text-amber-400" />;
    case 'weapon': return <ShieldAlert     className="w-3.5 h-3.5 text-orange-400" />;
    case 'crowd':  return <Users           className="w-3.5 h-3.5 text-yellow-400" />;
    case 'fire':   return <Flame           className="w-3.5 h-3.5 text-orange-500" />;
  }
}

// ── Fall skeleton: human figure lying down ───────────────────────────────────
function FallSkeleton({ stageW, stageH }: { stageW: number; stageH: number }) {
  const cx = stageW / 2;
  const cy = stageH / 2;
  return (
    <svg className="absolute inset-0 pointer-events-none" width={stageW} height={stageH}>
      {/* Pulsing body silhouette */}
      <g className="animate-pulse" transform={`translate(${cx}, ${cy})`}>
        {/* Head */}
        <circle cx={0} cy={-40} r={16} fill="none" stroke="#ef4444" strokeWidth={3} />
        {/* Torso (rotated — lying down) */}
        <line x1={0} y1={-24} x2={0} y2={20} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
        {/* Arms (horizontal) */}
        <line x1={-30} y1={-5} x2={30} y2={-5} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
        {/* Legs (spread) */}
        <line x1={0} y1={20} x2={-25} y2={50} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
        <line x1={0} y1={20} x2={25} y2={50} stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* Outer pulse ring */}
      <circle cx={cx} cy={cy} r={80} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.3} className="animate-ping" />
    </svg>
  );
}

// ── Soundwave ripple: concentric circles from mic icon ───────────────────────
function SoundwaveRipple({ stageW, stageH }: { stageW: number; stageH: number }) {
  const cx = stageW / 2;
  const cy = stageH - 60;
  return (
    <svg className="absolute inset-0 pointer-events-none" width={stageW} height={stageH}>
      {/* Mic dot */}
      <circle cx={cx} cy={cy} r={10} fill="#f59e0b" opacity={0.9} />
      {/* Ripple rings at different animation delays */}
      {[40, 70, 100, 130].map((r, i) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          opacity={0.6 - i * 0.12}
          style={{ animation: `ping ${1.2 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite`, animationDelay: `${i * 0.25}s` }}
        />
      ))}
      {/* Bar waveform at top */}
      {Array.from({ length: 24 }).map((_, i) => {
        const barH = 6 + Math.abs(Math.sin(i * 0.8)) * 22;
        return (
          <rect
            key={i}
            x={stageW / 2 - 12 * 7 + i * 7}
            y={20 + 25 - barH / 2}
            width={4}
            height={barH}
            rx={2}
            fill="#f59e0b"
            opacity={0.5 + Math.abs(Math.sin(i * 0.8)) * 0.4}
            className="animate-pulse"
            style={{ animationDelay: `${i * 0.04}s` }}
          />
        );
      })}
    </svg>
  );
}

// ── Fire flicker: wavy flame shapes ──────────────────────────────────────────
function FireFlicker({ stageW, stageH }: { stageW: number; stageH: number }) {
  return (
    <svg className="absolute bottom-0 left-0 pointer-events-none" width={stageW} height={stageH / 3}>
      {[0.15, 0.3, 0.5, 0.7, 0.85].map((frac, i) => {
        const x = frac * stageW;
        const h = 40 + i * 15;
        return (
          <ellipse
            key={i}
            cx={x}
            cy={stageH / 3}
            rx={12 + i * 3}
            ry={h}
            fill={i % 2 === 0 ? '#f97316' : '#ef4444'}
            opacity={0.35}
            className="animate-pulse"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: `${0.7 + i * 0.1}s` }}
          />
        );
      })}
    </svg>
  );
}

// ── Crowd pulse: grid of person icons ────────────────────────────────────────
function CrowdPulse({ stageW, stageH }: { stageW: number; stageH: number }) {
  const positions = Array.from({ length: 9 }, (_, i) => ({
    x: stageW * (0.2 + (i % 3) * 0.3),
    y: stageH * (0.3 + Math.floor(i / 3) * 0.2),
  }));
  return (
    <svg className="absolute inset-0 pointer-events-none" width={stageW} height={stageH}>
      {positions.map((pos, i) => (
        <circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r={12}
          fill="#eab308"
          opacity={0.25}
          className="animate-ping"
          style={{ animationDelay: `${i * 0.12}s`, animationDuration: `1.4s` }}
        />
      ))}
      {positions.map((pos, i) => (
        <circle key={`dot-${i}`} cx={pos.x} cy={pos.y} r={4} fill="#eab308" opacity={0.7} />
      ))}
    </svg>
  );
}

// ── Weapon stripe: diagonal danger warning ────────────────────────────────────
function WeaponStripe({ stageW, stageH }: { stageW: number; stageH: number }) {
  return (
    <svg className="absolute inset-0 pointer-events-none animate-pulse" width={stageW} height={stageH}>
      {/* Diagonal hazard stripes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1={stageW * 0.05 + i * (stageW / 7)}
          y1={stageH * 0.2}
          x2={stageW * 0.05 + i * (stageW / 7) - stageH * 0.6}
          y2={stageH * 0.8}
          stroke="#f97316"
          strokeWidth={18}
          opacity={0.12}
        />
      ))}
      {/* Central X ──────────────────────────── */}
      <line x1={stageW * 0.2} y1={stageH * 0.3} x2={stageW * 0.8} y2={stageH * 0.7} stroke="#f97316" strokeWidth={3} opacity={0.4} />
      <line x1={stageW * 0.8} y1={stageH * 0.3} x2={stageW * 0.2} y2={stageH * 0.7} stroke="#f97316" strokeWidth={3} opacity={0.4} />
    </svg>
  );
}

// ─── Konva canvas — must be loaded client-side only ──────────────────────────
const BoundingBoxDrawer = dynamic(() => import('./BoundingBoxDrawer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-slate-800/50 border border-slate-700/50 rounded-xl"
      style={{ width: STAGE_W, height: STAGE_H }}>
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <span className="w-3 h-3 rounded-full bg-cyan-500/50 animate-pulse" />
        Initialising canvas…
      </div>
    </div>
  ),
});

// Canvas dimensions — fixed 16:9 ratio
const STAGE_W = 800;
const STAGE_H = 450;

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'Select Center' },
  { num: 2, label: 'Select Camera' },
  { num: 3, label: 'Draw Zone' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function MappingPageClient() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [centers, setCenters]           = useState<Center[]>([]);
  const [centersLoading, setCentLoading] = useState(true);
  const [cameras, setCameras]           = useState<Camera[]>([]);
  const [camsLoading, setCamsLoading]   = useState(false);

  // ── Selections ──────────────────────────────────────────────────────────────
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [drawnBox,       setDrawnBox]        = useState<BBoxNorm | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  /**
   * Incrementing key forces BoundingBoxDrawer to remount (clearing drawn box)
   * after a successful submission or camera change.
   */
  const [canvasKey, setCanvasKey] = useState(0);

  // ── Live AI overlays ──────────────────────────────────────────────────────
  const [activeOverlays, setActiveOverlays] = useState<ActiveOverlay[]>([]);
  const overlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived step ─────────────────────────────────────────────────────────────
  const step = !selectedCenter ? 1 : !selectedCamera ? 2 : 3;

  // ── Socket ───────────────────────────────────────────────────────────────────
  const { socket } = useSocket();

  // ── Load all centers once ────────────────────────────────────────────────────
  useEffect(() => {
    centersApi
      .getAll({ isActive: true })
      .then(({ data }) => setCenters(data))
      .catch(console.error)
      .finally(() => setCentLoading(false));
  }, []);

  // ── Live AI overlay WS subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedCenter) return;

    const handlers: Array<{ event: string; fn: (data: unknown) => void }> = [];

    for (const event of OVERLAY_EVENTS) {
      const fn = (data: unknown) => {
        const envelope = data as WsEventEnvelope;
        // Only show overlay if the alert is for the currently selected center
        if (envelope.centerId !== selectedCenter.id) return;

        const kind = EVENT_TO_OVERLAY[event];
        if (!kind) return;

        const overlay: ActiveOverlay = {
          id:        `${event}-${Date.now()}`,
          kind,
          label:     OVERLAY_META[kind].label,
          centerId:  envelope.centerId,
          expiresAt: Date.now() + OVERLAY_TTL_MS,
        };

        setActiveOverlays((prev) => {
          // Replace existing same-kind overlay so we don't stack duplicates
          const filtered = prev.filter((o) => o.kind !== kind);
          return [...filtered, overlay];
        });
      };
      socket.on(event, fn);
      handlers.push({ event, fn });
    }

    return () => {
      handlers.forEach(({ event, fn }) => socket.off(event, fn));
    };
  }, [socket, selectedCenter]);

  // ── Auto-expire overlays every second ────────────────────────────────────────
  useEffect(() => {
    overlayTimerRef.current = setInterval(() => {
      const now = Date.now();
      setActiveOverlays((prev) => prev.filter((o) => o.expiresAt > now));
    }, 1_000);

    return () => {
      if (overlayTimerRef.current) clearInterval(overlayTimerRef.current);
    };
  }, []);

  // ── Clear overlays on camera/center change ────────────────────────────────────
  useEffect(() => {
    setActiveOverlays([]);
  }, [selectedCamera, selectedCenter]);

  // ── Load cameras when center changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedCenter) {
      setCameras([]);
      return;
    }
    setCamsLoading(true);
    setSelectedCamera(null);
    setDrawnBox(null);
    setDrawerOpen(false);
    setCanvasKey((k) => k + 1);

    centersApi
      .getCameras(selectedCenter.id)
      .then(({ data }) => setCameras(data))
      .catch(console.error)
      .finally(() => setCamsLoading(false));
  }, [selectedCenter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCenterChange = (id: string) => {
    setSelectedCenter(centers.find((c) => c.id === id) ?? null);
  };

  const handleCameraChange = (id: string) => {
    setSelectedCamera(cameras.find((c) => c.id === id) ?? null);
    setDrawnBox(null);
    setDrawerOpen(false);
    setCanvasKey((k) => k + 1);
  };

  /** Called by BoundingBoxDrawer — opens drawer after short delay */
  const handleBoxDrawn = useCallback((norm: BBoxNorm) => {
    setDrawnBox(norm);
    setTimeout(() => setDrawerOpen(true), 250);
  }, []);

  /** Called when user clicks "Clear box" inside the canvas */
  const handleBoxClear = useCallback(() => {
    setDrawnBox(null);
    setDrawerOpen(false);
  }, []);

  /** Called after successful POST — reset canvas for next zone */
  const handleSuccess = useCallback(() => {
    setDrawnBox(null);
    setDrawerOpen(false);
    setCanvasKey((k) => k + 1);
  }, []);

  // ── AI Settings modal ───────────────────────────────────────────────────────
  const [aiModalOpen, setAiModalOpen]         = useState(false);
  const [aiCamera, setAiCamera]               = useState<Camera | null>(null);

  const handleOpenAiSettings = useCallback((cam: Camera) => {
    setAiCamera(cam);
    setAiModalOpen(true);
  }, []);

  /** Keep the local camera list in sync when a feature is toggled */
  const handleAiUpdate = useCallback((updated: Camera) => {
    setCameras((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCamera?.id === updated.id) setSelectedCamera(updated);
    setAiCamera(updated);
  }, [selectedCamera]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Map className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Hardware Mapping</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Draw bounding boxes over tables and link them to microphones &amp; agents
          </p>
        </div>
      </div>

      {/* ── Step progress indicator ─────────────────────────────────────────── */}
      <div className="flex items-center mb-8">
        {STEPS.map(({ num, label }, i) => {
          const isDone   = step > num;
          const isActive = step === num;
          return (
            <div key={num} className="flex items-center">
              {/* Pill */}
              <div className={`
                flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium
                border transition-all duration-300
                ${isDone
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : isActive
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-600'}
              `}>
                <span className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${isDone
                    ? 'bg-cyan-500 text-slate-900'
                    : isActive
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-800 text-slate-600'}
                `}>
                  {isDone ? '✓' : num}
                </span>
                {label}
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`
                  w-10 h-px mx-1 transition-colors duration-500
                  ${isDone ? 'bg-cyan-500/40' : 'bg-slate-800'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Selector row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* Center selector */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Center
            </span>
          </div>
          {centersLoading ? (
            <div className="h-10 bg-slate-700/40 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedCenter?.id ?? ''}
              onChange={(e) => handleCenterChange(e.target.value)}
              className="w-full h-10 bg-slate-800/80 border border-slate-700 rounded-lg px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
            >
              <option value="">— Select a center —</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Camera selector */}
        <div className={`card p-4 transition-opacity duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-40'}`}>
          <div className="flex items-center gap-2 mb-3">
            <CameraIcon className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Camera
            </span>
          </div>
          {camsLoading ? (
            <div className="h-10 bg-slate-700/40 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedCamera?.id ?? ''}
              onChange={(e) => handleCameraChange(e.target.value)}
              disabled={!selectedCenter || camsLoading}
              className="w-full h-10 bg-slate-800/80 border border-slate-700 rounded-lg px-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">— Select a camera —</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.ipAddress ? ` (${c.ipAddress})` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedCenter && !camsLoading && cameras.length === 0 && (
            <p className="text-xs text-slate-500 mt-2">No cameras found for this center.</p>
          )}
        </div>
      </div>

      {/* ── Canvas area ─────────────────────────────────────────────────────── */}
      {selectedCamera && (
        <div className="space-y-4">

          {/* Canvas toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Camera Frame — {selectedCamera.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {drawnBox
                  ? '✅ Zone drawn — click "Link Table Zone" or redraw to update'
                  : 'Click and drag on the canvas to draw a bounding box over a table'}
              </p>
            </div>
            <div className="flex items-center gap-2">

              {/* Live AI alert indicator — shown when overlays are active */}
              {activeOverlays.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="font-semibold">LIVE ALERT</span>
                  {activeOverlays.map((o) => (
                    <span key={o.id} className="text-red-300">{OVERLAY_META[o.kind].label}</span>
                  ))}
                </div>
              )}

              {/* Reset camera selection */}
              <button
                onClick={() => {
                  setSelectedCamera(null);
                  setDrawnBox(null);
                  setCanvasKey((k) => k + 1);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Switch camera
              </button>

              {/* AI Settings button */}
              <button
                onClick={() => handleOpenAiSettings(selectedCamera!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-700/40 bg-cyan-500/5 text-xs text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-600 transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                AI Settings
                {selectedCamera && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                    {(selectedCamera.aiFeatures ?? []).length}
                  </span>
                )}
              </button>

              {/* Open drawer — prominent when box is ready */}
              {drawnBox && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-900 text-sm font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Link Table Zone
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Konva Stage — key forces remount on camera change or after success */}
          <div className="relative overflow-x-auto rounded-xl">
            <BoundingBoxDrawer
              key={`${selectedCamera.id}-${canvasKey}`}
              stageW={STAGE_W}
              stageH={STAGE_H}
              cameraName={selectedCamera.name}
              cameraIp={selectedCamera.ipAddress}
              existingBox={drawnBox}
              onBoxDrawn={handleBoxDrawn}
              onClear={handleBoxClear}
            />
            {/* Live AI alert overlays — only shown when a center is selected */}
            <CanvasOverlay
              overlays={activeOverlays}
              stageW={STAGE_W}
              stageH={STAGE_H}
            />
          </div>

          {/* Coordinate info strip (shown after draw) */}
          {drawnBox && (
            <div className="flex items-center gap-6 px-5 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-xs font-mono">
              <span className="text-slate-500">Normalized bbox →</span>
              {(['x', 'y', 'width', 'height'] as const).map((k) => (
                <span key={k}>
                  <span className="text-slate-500">{k}: </span>
                  <span className="text-cyan-400">{drawnBox[k].toFixed(4)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Placeholder when no camera selected ─────────────────────────────── */}
      {!selectedCamera && !centersLoading && (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 text-slate-600">
          <CameraIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Select a center and camera to begin mapping</p>
        </div>
      )}

      {/* ── Slide-out form ───────────────────────────────────────────────────── */}
      <LinkTableDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={handleSuccess}
        center={selectedCenter}
        camera={selectedCamera}
        boundingBox={drawnBox}
      />
      {/* ── AI Settings modal ─────────────────────────────────────────────────────────────────── */}
      <AiSettingsModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        camera={aiCamera}
        onUpdate={handleAiUpdate}
      />    </div>
  );
}
