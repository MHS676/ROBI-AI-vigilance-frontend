'use client';

/**
 * CsiPlaybackPanel — WiFi Sensing (CSI) "WiFi Footage" playback UI.
 *
 * Modes:
 *   LIVE   — subscribes to WebSocket `update:wifi_sensing` events and feeds
 *            incoming frames directly into the WifiHeatmap waterfall in real
 *            time. No API calls required.
 *
 *   RECORD — loads a historical time range from
 *            GET /api/v1/csi-logs/playback?centerId=&tableId=&nodeId=&from=&to=
 *            and plays it back with a timeline scrubber.
 *
 * File browser:
 *   Calls GET /api/v1/csi-logs/files?centerId= to list available log files.
 *   The user can pick a date and node from dropdowns to load a session.
 *
 * Props:
 *   centerId   — current center (required)
 *   tableId    — current table (optional, defaults to "_center")
 *   nodeId     — pre-selected ESP32 node MAC address (optional)
 *
 * Playback controls:
 *   ◀◀ (−30s)  ▶/⏸ (play/pause)  ▶▶ (+30s)  speed (1× 2× 5× 10×)
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Radio,
  RefreshCw,
  Film,
  ChevronDown,
  Clock,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import WifiHeatmap, { type CsiFrame } from './WifiHeatmap';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const LIVE_MAX_FRAMES = 120; // rolling buffer for live mode
const PLAYBACK_SPEEDS = [1, 2, 5, 10] as const;
const DEFAULT_RANGE_MINUTES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CsiLogFile {
  path: string;
  centerId: string;
  tableId: string;
  date: string;
  nodeId: string;
  sizeBytes: number;
  frameCount: number | null;
}

interface Props {
  centerId: string;
  tableId?: string;
  nodeId?: string;
  /** Floor-plan dimensions for the spatial overlay. */
  floorWidth?: number;
  floorHeight?: number;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  return new Date(ts * 1_000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function toLocalDatetimeString(d: Date): string {
  // Returns "YYYY-MM-DDTHH:MM" suitable for <input type="datetime-local" />
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CsiPlaybackPanel({
  centerId,
  tableId: propTableId,
  nodeId: propNodeId,
  floorWidth,
  floorHeight,
  className = '',
}: Props) {
  // ── Mode ────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'live' | 'record'>('live');

  // ── Live mode state ─────────────────────────────────────────────────────
  const [liveFrames, setLiveFrames] = useState<CsiFrame[]>([]);
  const liveFramesRef = useRef<CsiFrame[]>([]);

  // ── File browser state ──────────────────────────────────────────────────
  const [files, setFiles] = useState<CsiLogFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CsiLogFile | null>(null);

  // ── Playback range ──────────────────────────────────────────────────────
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_RANGE_MINUTES * 60 * 1_000);
  const [fromDt, setFromDt] = useState(toLocalDatetimeString(defaultFrom));
  const [toDt, setToDt] = useState(toLocalDatetimeString(now));

  // ── Playback state ──────────────────────────────────────────────────────
  const [allFrames, setAllFrames] = useState<CsiFrame[]>([]);
  const [cursor, setCursor] = useState(0); // index into allFrames
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const visibleTableId = selectedFile?.tableId ?? propTableId ?? '_center';
  const visibleNodeId = selectedFile?.nodeId ?? propNodeId;
  const currentFrame = allFrames[cursor] ?? null;

  // Frames shown in the heatmap during playback = frames up to cursor
  const playbackFrames = useMemo(
    () => allFrames.slice(0, cursor + 1).slice(-LIVE_MAX_FRAMES),
    [allFrames, cursor],
  );

  // ── Load file list ───────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const url = new URL(`${API_BASE}/csi-logs/files`);
      url.searchParams.set('centerId', centerId);
      if (propTableId) url.searchParams.set('tableId', propTableId);

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (e: any) {
      setError(`Failed to load file list: ${e.message}`);
    } finally {
      setFilesLoading(false);
    }
  }, [centerId, propTableId]);

  useEffect(() => {
    if (mode === 'record') loadFiles();
  }, [mode, loadFiles]);

  // ── Load playback frames from API ────────────────────────────────────────
  const loadPlayback = useCallback(async () => {
    const tid = selectedFile ? selectedFile.tableId : (propTableId ?? '_center');
    const nid = selectedFile ? selectedFile.nodeId : propNodeId;
    const dateStr = selectedFile ? selectedFile.date : null;

    if (!nid) {
      setError('Select a node or log file first.');
      return;
    }

    // If a specific file is selected, override the time range to that whole day
    let from = fromDt;
    let to = toDt;
    if (dateStr) {
      from = `${dateStr}T00:00`;
      to = `${dateStr}T23:59`;
    }

    setLoading(true);
    setError(null);
    setPlaying(false);
    setCursor(0);

    try {
      const url = new URL(`${API_BASE}/csi-logs/playback`);
      url.searchParams.set('centerId', centerId);
      url.searchParams.set('tableId', tid);
      url.searchParams.set('nodeId', nid);
      url.searchParams.set('from', new Date(from).toISOString());
      url.searchParams.set('to', new Date(to).toISOString());

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.frames?.length) {
        setError('No CSI frames found for this time range.');
        setAllFrames([]);
        return;
      }

      setAllFrames(data.frames);
      setCursor(0);
    } catch (e: any) {
      setError(`Load failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [centerId, propTableId, propNodeId, selectedFile, fromDt, toDt]);

  // ── Playback interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    if (!playing || mode !== 'record') return;

    // Each "tick" advances by speed frames
    playIntervalRef.current = setInterval(() => {
      setCursor((prev) => {
        const next = prev + speed;
        if (next >= allFrames.length - 1) {
          setPlaying(false);
          return allFrames.length - 1;
        }
        return next;
      });
    }, 100); // 10 fps base rate; at 10× speed = 100 frames/sec

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [playing, speed, mode, allFrames.length]);

  // ── Live frame injection (from WebSocket) ────────────────────────────────
  // NOTE: Hook into the existing useSocket / socket instance.
  // Here we expose a ref-based handler so a parent can call pushLiveFrame().
  const pushLiveFrame = useCallback((frame: CsiFrame) => {
    if (mode !== 'live') return;
    liveFramesRef.current = [...liveFramesRef.current.slice(-(LIVE_MAX_FRAMES - 1)), frame];
    setLiveFrames([...liveFramesRef.current]);
  }, [mode]);

  // Expose the handler on the window object so the socket hook can call it
  useEffect(() => {
    (window as any).__csiPlaybackPushFrame = pushLiveFrame;
    return () => { delete (window as any).__csiPlaybackPushFrame; };
  }, [pushLiveFrame]);

  // ── Render ───────────────────────────────────────────────────────────────

  const displayedFrames = mode === 'live' ? liveFrames : playbackFrames;
  const playbackCursorRow = mode === 'record' ? Math.min(cursor, LIVE_MAX_FRAMES - 1) : null;

  return (
    <div className={cn('flex flex-col gap-3 bg-slate-950/80 rounded-xl border border-cyan-900/30 p-4', className)}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">
            WiFi Sensing Playback
          </span>
          {visibleNodeId && (
            <span className="text-[10px] font-mono text-slate-500 ml-1">
              node: {visibleNodeId}
            </span>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          {(['live', 'record'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors',
                mode === m
                  ? 'bg-cyan-700/60 text-cyan-200'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200',
              )}
            >
              {m === 'live' ? <Radio className="w-3 h-3" /> : <Film className="w-3 h-3" />}
              {m === 'live' ? 'Live' : 'Playback'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Record mode: file browser + controls ───────────────────────── */}
      {mode === 'record' && (
        <div className="flex flex-col gap-2">

          {/* File list dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <select
                className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 pr-8"
                value={selectedFile?.path ?? ''}
                onChange={(e) => {
                  const f = files.find((x) => x.path === e.target.value) ?? null;
                  setSelectedFile(f);
                  setAllFrames([]);
                  setError(null);
                }}
              >
                <option value="">— Select a log file —</option>
                {files.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.date} · {f.tableId} · {f.nodeId} · {formatBytes(f.sizeBytes)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            </div>

            <button
              onClick={loadFiles}
              disabled={filesLoading}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3 h-3', filesLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Time range — shown when no specific file is selected */}
          {!selectedFile && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <label className="flex items-center gap-1">
                From
                <input
                  type="datetime-local"
                  value={fromDt}
                  onChange={(e) => setFromDt(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs ml-1"
                />
              </label>
              <label className="flex items-center gap-1">
                To
                <input
                  type="datetime-local"
                  value={toDt}
                  onChange={(e) => setToDt(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs ml-1"
                />
              </label>
            </div>
          )}

          {/* Load + playback controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadPlayback}
              disabled={loading || (!selectedFile && !propNodeId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Film className="w-3 h-3" />
              )}
              Load
            </button>

            {allFrames.length > 0 && (
              <>
                {/* Rewind 30 frames */}
                <button
                  onClick={() => setCursor((c) => Math.max(0, c - 30))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                {/* Play / Pause */}
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {playing ? 'Pause' : 'Play'}
                </button>

                {/* Fast-forward 30 frames */}
                <button
                  onClick={() => setCursor((c) => Math.min(allFrames.length - 1, c + 30))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                {/* Speed selector */}
                <div className="flex items-center gap-1 ml-1">
                  {PLAYBACK_SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={cn(
                        'px-2 py-1 rounded text-xs font-mono transition-colors',
                        speed === s
                          ? 'bg-cyan-700 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200',
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                {/* Frame counter */}
                <span className="text-xs font-mono text-slate-500 ml-auto">
                  {cursor + 1} / {allFrames.length}
                  {currentFrame && (
                    <span className="ml-2 text-cyan-600">{formatTs(currentFrame.ts)}</span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Timeline scrubber */}
          {allFrames.length > 1 && (
            <input
              type="range"
              min={0}
              max={allFrames.length - 1}
              value={cursor}
              onChange={(e) => {
                setPlaying(false);
                setCursor(Number(e.target.value));
              }}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          )}
        </div>
      )}

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Heatmap ───────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Live indicator */}
        {mode === 'live' && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-slate-950/80 rounded px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">
              Live · {liveFrames.length} frames
            </span>
          </div>
        )}

        <WifiHeatmap
          frames={displayedFrames}
          maxRows={LIVE_MAX_FRAMES}
          width={520}
          height={300}
          floorWidth={floorWidth}
          floorHeight={floorHeight}
          playbackCursor={playbackCursorRow}
        />
      </div>

      {/* ── Footer info ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-600">
        <span>center: {centerId}</span>
        <span>table: {visibleTableId}</span>
        {mode === 'record' && allFrames.length > 0 && (
          <>
            <span>frames: {allFrames.length}</span>
            <span>
              {formatTs(allFrames[0].ts)} → {formatTs(allFrames[allFrames.length - 1].ts)}
            </span>
          </>
        )}
        {mode === 'live' && liveFrames.length > 0 && (
          <span>latest: {formatTs(liveFrames[liveFrames.length - 1].ts)}</span>
        )}
      </div>
    </div>
  );
}
