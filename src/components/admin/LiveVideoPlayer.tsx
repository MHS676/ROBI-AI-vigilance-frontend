'use client';

/**
 * LiveVideoPlayer — HLS-capable surveillance video player.
 *
 * - Accepts a list of cameras for the center and renders a camera-switcher.
 * - If the selected camera's rtspUrl contains `.m3u8`, hls.js is loaded
 *   dynamically and attaches to the <video> element.
 * - If the URL is RTSP-only (no HLS transcoder configured), a dark
 *   surveillance-aesthetic placeholder is shown with stream metadata.
 * - A Canvas overlay is drawn on top of the video/placeholder to render
 *   live AI bounding boxes from the Zustand tableStatuses store.
 * - Fullscreen and picture-in-picture controls are included.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  VideoOff,
  Aperture,
} from 'lucide-react';
import { useAlertsStore } from '@/store/alerts.store';
import type { Camera } from '@/types';
import { DEVICE_STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  cameras: Camera[];
  /** Used to scope bounding box overlay to matching centerId events */
  centerId: string;
}

// ─── Helper: is URL HLS? ──────────────────────────────────────────────────────
function isHlsUrl(url: string): boolean {
  return url.toLowerCase().includes('.m3u8');
}

// ─── Surveillance placeholder canvas ─────────────────────────────────────────
function drawPlaceholder(
  canvas: HTMLCanvasElement,
  camera: Camera,
  status: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0d1117');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(6,182,212,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

  // Corner brackets
  const pad = 16, arm = 20;
  ctx.strokeStyle = status === 'ONLINE' ? 'rgba(6,182,212,0.35)' : 'rgba(239,68,68,0.3)';
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

  // REC / OFFLINE badge
  const isOnline = status === 'ONLINE';
  ctx.fillStyle = isOnline ? '#f87171' : '#6b7280';
  ctx.beginPath(); ctx.arc(pad + 8, pad + 8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isOnline ? 'rgba(248,113,113,0.8)' : 'rgba(107,114,128,0.8)';
  ctx.font = '500 10px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(isOnline ? 'REC' : 'OFFLINE', pad + 16, pad + 12);

  // Camera name
  ctx.fillStyle = 'rgba(6,182,212,0.6)';
  ctx.font = '600 13px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`📷  ${camera.name}`, pad + 2, h - pad - 22);

  // IP address
  if (camera.ipAddress) {
    ctx.fillStyle = 'rgba(100,116,139,0.7)';
    ctx.font = '11px "SF Mono", Menlo, monospace';
    ctx.fillText(camera.ipAddress, pad + 2, h - pad - 6);
  }

  // Center message
  ctx.fillStyle = isOnline
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(239,68,68,0.25)';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isOnline
      ? 'RTSP stream detected'
      : 'Camera offline',
    w / 2, h / 2 - 14,
  );
  ctx.fillStyle = isOnline
    ? 'rgba(255,255,255,0.07)'
    : 'rgba(239,68,68,0.15)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    isOnline
      ? 'Configure an HLS transcoder to view in-browser'
      : 'Check network connectivity or device power',
    w / 2, h / 2 + 8,
  );
}

// ─── AI bounding-box overlay ──────────────────────────────────────────────────
function drawOverlay(
  canvas: HTMLCanvasElement,
  tableStatuses: ReturnType<typeof useAlertsStore.getState>['tableStatuses'],
  centerId: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  Object.values(tableStatuses).forEach((ts) => {
    if (ts.centerId !== centerId || !ts.boundingBoxPx) return;
    const { x, y, width, height } = ts.boundingBoxPx;
    const isAlert = ts.isFallDetected || ts.isAggressionDetected || ts.isAudioAlert;

    // Box stroke
    ctx.strokeStyle = isAlert ? 'rgba(239,68,68,0.9)' : 'rgba(6,182,212,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash(isAlert ? [] : [6, 4]);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);

    // Fill
    ctx.fillStyle = isAlert
      ? 'rgba(239,68,68,0.08)'
      : 'rgba(6,182,212,0.07)';
    ctx.fillRect(x, y, width, height);

    // Label background
    const label = `${ts.tableName} · ${ts.customerCount} pax`;
    ctx.font = '600 11px system-ui';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = isAlert ? 'rgba(239,68,68,0.85)' : 'rgba(6,182,212,0.85)';
    ctx.fillRect(x, y - 20, tw + 12, 18);

    // Label text
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 6, y - 6);

    // Agent indicator
    if (ts.agentPresent) {
      ctx.fillStyle = 'rgba(16,185,129,0.85)';
      ctx.beginPath();
      ctx.arc(x + width - 8, y + 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveVideoPlayer({ cameras, centerId }: Props) {
  const tableStatuses = useAlertsStore((s) => s.tableStatuses);

  const [selectedId,    setSelectedId]    = useState<string>(cameras[0]?.id ?? '');
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [streamError,   setStreamError]   = useState<string | null>(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);

  const videoRef:    RefObject<HTMLVideoElement>   = useRef(null);
  const placeholderRef: RefObject<HTMLCanvasElement> = useRef(null);
  const overlayRef:  RefObject<HTMLCanvasElement>  = useRef(null);
  const wrapperRef:  RefObject<HTMLDivElement>     = useRef(null);
  // Store Hls instance so we can destroy it on camera change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  const selectedCamera = cameras.find((c) => c.id === selectedId) ?? cameras[0] ?? null;

  // ── Draw placeholder when selected camera changes ─────────────────────────
  useEffect(() => {
    const canvas = placeholderRef.current;
    if (!canvas || !selectedCamera) return;
    drawPlaceholder(canvas, selectedCamera, selectedCamera.status);
  }, [selectedCamera]);

  // ── HLS / video setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedCamera) return;

    // Tear down previous hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setStreamError(null);
    setIsPlaying(false);

    const url = selectedCamera.rtspUrl;
    if (!url || !isHlsUrl(url) || selectedCamera.status !== 'ONLINE') return;

    // Dynamic import — keeps Hls out of the SSR bundle
    import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        // Native HLS (Safari)
        video.src = url;
        video.play().catch(() => setStreamError('Autoplay blocked'));
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean; details?: string }) => {
        if (data.fatal) {
          setStreamError(`Stream error: ${data.details ?? 'unknown'}`);
          hls.destroy();
        }
      });
    });

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [selectedCamera]);

  // ── Overlay repaint whenever tableStatuses update ─────────────────────────
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    drawOverlay(canvas, tableStatuses, centerId);
  }, [tableStatuses, centerId]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setIsPlaying(true)).catch(() => {}); }
    else           { v.pause(); setIsPlaying(false); }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const togglePip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture().catch(() => {});
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const showVideoElement = !!selectedCamera && isHlsUrl(selectedCamera.rtspUrl ?? '') && selectedCamera.status === 'ONLINE';
  const showPlaceholder  = !showVideoElement;

  const W = 800;
  const H = 450;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            {selectedCamera?.status === 'ONLINE'
              ? <Wifi className="w-4 h-4 text-emerald-400" />
              : <WifiOff className="w-4 h-4 text-slate-500" />}
            Live Video Feed
          </h2>
          {selectedCamera && (
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedCamera.model || 'IP Camera'}&nbsp;·&nbsp;
              <span className={cn(
                'font-medium',
                DEVICE_STATUS_COLORS[selectedCamera.status].split(' ')[0],
              )}>
                {selectedCamera.status}
              </span>
            </p>
          )}
        </div>

        {/* Camera selector */}
        {cameras.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <Aperture className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="max-w-[140px] truncate">
                {selectedCamera?.name ?? 'Select camera'}
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                {cameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => { setSelectedId(cam.id); setDropdownOpen(false); }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 transition-colors',
                      cam.id === selectedId
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800',
                    )}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      cam.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-slate-600',
                    )} />
                    <span className="truncate">{cam.name}</span>
                    {cam.ipAddress && (
                      <span className="ml-auto text-slate-600 font-mono shrink-0">
                        {cam.ipAddress.split('.').slice(-1)[0]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Canvas / Video wrapper ───────────────────────────────────────── */}
      <div
        ref={wrapperRef}
        className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800/60 shadow-2xl shadow-slate-950/50 flex-1 min-h-0"
        style={{ aspectRatio: '16/9' }}
        onClick={() => setDropdownOpen(false)}
      >
        {/* Placeholder canvas */}
        {showPlaceholder && (
          <canvas
            ref={placeholderRef}
            width={W}
            height={H}
            className="w-full h-full object-cover"
          />
        )}

        {/* HLS video element */}
        {showVideoElement && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setStreamError('Stream failed to load')}
          />
        )}

        {/* AI bounding-box overlay */}
        <canvas
          ref={overlayRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Stream error banner */}
        {streamError && (
          <div className="absolute inset-x-0 top-3 mx-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <VideoOff className="w-3.5 h-3.5 shrink-0" />
            {streamError}
          </div>
        )}

        {/* No cameras state */}
        {!selectedCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
            <VideoOff className="w-10 h-10 opacity-40" />
            <p className="text-sm">No cameras configured for this center</p>
          </div>
        )}

        {/* ── Controls overlay ────────────────────────────────────────────── */}
        {selectedCamera && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-8 flex items-center gap-3">
            {/* Play/Pause (only when video is active) */}
            {showVideoElement && (
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause className="w-3.5 h-3.5" />
                  : <Play  className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={() => { setSelectedId(''); setTimeout(() => setSelectedId(selectedCamera.id), 50); }}
              className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Reconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* PiP */}
            {showVideoElement && (
              <button
                onClick={togglePip}
                className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Picture in Picture"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen
                ? <Minimize2 className="w-3.5 h-3.5" />
                : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
