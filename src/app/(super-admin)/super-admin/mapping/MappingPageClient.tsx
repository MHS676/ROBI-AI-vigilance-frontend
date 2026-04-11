'use client';

/**
 * MappingPageClient — full Hardware Mapping UI orchestrator.
 *
 * Flow:
 *   Step 1 → Select a Center
 *   Step 2 → Select a Camera (filtered by chosen center)
 *   Step 3 → Draw a bounding box on the camera placeholder canvas
 *   Drawer → Link the zone to a Table, Microphone, and Agent
 */

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Map,
  Building2,
  Camera as CameraIcon,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Bot,
} from 'lucide-react';
import { centersApi } from '@/lib/api';
import type { Center, Camera } from '@/types';
import type { BBoxNorm } from './BoundingBoxDrawer';
import LinkTableDrawer from './LinkTableDrawer';
import AiSettingsModal from './AiSettingsModal';

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

  // ── Derived step ─────────────────────────────────────────────────────────────
  const step = !selectedCenter ? 1 : !selectedCamera ? 2 : 3;

  // ── Load all centers once ────────────────────────────────────────────────────
  useEffect(() => {
    centersApi
      .getAll({ isActive: true })
      .then(({ data }) => setCenters(data))
      .catch(console.error)
      .finally(() => setCentLoading(false));
  }, []);

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
          <div className="overflow-x-auto rounded-xl">
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
