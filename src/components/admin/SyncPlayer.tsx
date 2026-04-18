'use client';

/**
 * SyncPlayer — synchronized Video + Audio + WiFi CSI playback.
 *
 * Given a recording session (a set of LocalMedia records sharing the same
 * tableId and recordingDate), this component:
 *
 *   1. Plays the VIDEO file via <video> with HTTP range support from
 *      GET /api/v1/local-media/stream/:id?token=
 *
 *   2. Plays the AUDIO file via <audio> similarly — both elements share the
 *      same `currentTime` via a master clock derived from the video element.
 *
 *   3. Displays the CSI Waterfall heatmap for the same time window, loaded
 *      from GET /api/v1/csi-logs/playback and scrolled by timestamp sync.
 *
 * Sync strategy:
 *   - The <video> element is the master clock.
 *   - On every `timeupdate` event, we compute:
 *       currentWallTs = sessionStartTs + video.currentTime
 *   - The CSI cursor is found via binary search on the frames[].ts array.
 *   - The <audio> element is kept in sync by comparing its currentTime to
 *     the video and seeking if the drift exceeds 200 ms.
 *
 * Props:
 *   session       — { videoId?, audioId?, tableId, centerId, recordingDate,
 *                     sessionStartTs, durationSec, nodeId? }
 *   onClose       — called when the user closes the player
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  Radio,
  Film,
  Mic,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { localMediaApi, csiLogsApi, type CsiFrame } from '@/lib/api';
import WifiHeatmap from './WifiHeatmap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncSession {
  /** LocalMedia id for the VIDEO file (null if no video available) */
  videoId: string | null
  /** LocalMedia id for the AUDIO file (null if no audio available) */
  audioId: string | null
  /** Table this session belongs to */
  tableId: string
  tableName?: string
  tableNumber?: number
  centerId: string
  /** "YYYY-MM-DD" */
  recordingDate: string
  /**
   * Unix timestamp (seconds) of the first frame in the recording.
   * Used to align the CSI cursor to video.currentTime.
   */
  sessionStartTs: number
  durationSec?: number | null
  /** ESP32 node MAC for CSI lookup */
  nodeId?: string | null
  /** Camera number (display only) */
  cameraNumber?: number | null
  /** Mic number (display only) */
  micNumber?: number | null
}

interface Props {
  session: SyncSession
  onClose: () => void
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Binary search: find the last frame index whose ts ≤ targetTs */
function findCsiCursor(frames: CsiFrame[], targetTs: number): number {
  if (!frames.length) return -1
  let lo = 0, hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].ts <= targetTs) lo = mid
    else hi = mid - 1
  }
  return frames[lo].ts <= targetTs ? lo : -1
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SyncPlayer({ session, onClose, className = '' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Playback state ────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(session.durationSec ?? 0)
  const [videoReady, setVideoReady] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  // ── CSI state ─────────────────────────────────────────────────────────────
  const [csiFrames, setCsiFrames] = useState<CsiFrame[]>([])
  const [csiLoading, setCsiLoading] = useState(false)
  const [csiError, setCsiError] = useState<string | null>(null)
  const [csiCursor, setCsiCursor] = useState(-1)

  // ── Stream URLs ───────────────────────────────────────────────────────────
  const videoUrl = useMemo(
    () => session.videoId ? localMediaApi.streamUrl(session.videoId) : null,
    [session.videoId]
  )
  const audioUrl = useMemo(
    () => session.audioId ? localMediaApi.streamUrl(session.audioId) : null,
    [session.audioId]
  )

  // ── Load CSI frames for this session ─────────────────────────────────────
  useEffect(() => {
    if (!session.nodeId || !session.tableId) return

    const from = new Date(session.sessionStartTs * 1_000).toISOString()
    const totalSecs = session.durationSec ?? 3600
    const to = new Date((session.sessionStartTs + totalSecs) * 1_000).toISOString()

    setCsiLoading(true)
    csiLogsApi
      .playback({
        centerId: session.centerId,
        tableId: session.tableId,
        nodeId: session.nodeId,
        from,
        to,
        limit: 2000,
      })
      .then(({ data }) => {
        setCsiFrames(data.frames ?? [])
        setCsiError(null)
      })
      .catch((e) => setCsiError(`CSI load failed: ${e?.message}`))
      .finally(() => setCsiLoading(false))
  }, [session.nodeId, session.tableId, session.centerId, session.sessionStartTs, session.durationSec])

  // ── Video event handlers ──────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    const t = vid.currentTime
    setCurrentTime(t)

    // Advance CSI cursor by wall timestamp
    const wallTs = session.sessionStartTs + t
    setCsiCursor(findCsiCursor(csiFrames, wallTs))

    // Sync audio to video (tolerate ±200 ms drift)
    const aud = audioRef.current
    if (aud && audioReady && !aud.paused) {
      const drift = Math.abs(aud.currentTime - t)
      if (drift > 0.2) aud.currentTime = t
    }
  }, [csiFrames, session.sessionStartTs, audioReady])

  const handleLoadedMetadata = useCallback(() => {
    const vid = videoRef.current
    if (vid) {
      setDuration(vid.duration || session.durationSec || 0)
      setVideoReady(true)
    }
  }, [session.durationSec])

  const handlePlay = useCallback(() => setPlaying(true), [])
  const handlePause = useCallback(() => setPlaying(false), [])
  const handleEnded = useCallback(() => setPlaying(false), [])
  const handleVideoError = useCallback(() => {
    setVideoError('Video stream unavailable — check if the file exists on disk.')
  }, [])
  const handleAudioError = useCallback(() => {
    setAudioError('Audio stream unavailable.')
    setAudioReady(true) // don't block playback
  }, [])

  // ── Play / Pause master control ───────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const vid = videoRef.current
    const aud = audioRef.current
    if (!vid) return

    if (vid.paused) {
      void vid.play()
      if (aud && !audioError) {
        aud.currentTime = vid.currentTime
        void aud.play().catch(() => {})
      }
    } else {
      vid.pause()
      aud?.pause()
    }
  }, [audioError])

  // ── Seek ──────────────────────────────────────────────────────────────────

  const seek = useCallback((t: number) => {
    const vid = videoRef.current
    const aud = audioRef.current
    if (vid) vid.currentTime = t
    if (aud) aud.currentTime = t
    setCurrentTime(t)

    const wallTs = session.sessionStartTs + t
    setCsiCursor(findCsiCursor(csiFrames, wallTs))
  }, [csiFrames, session.sessionStartTs])

  // ── Volume ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const aud = audioRef.current
    if (aud) {
      aud.volume = volume
      aud.muted = muted
    }
  }, [volume, muted])

  // ── Fullscreen ───────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // ── CSI frames to show in heatmap (up to cursor) ─────────────────────────
  const visibleCsiFrames = useMemo(() => {
    if (csiCursor < 0) return []
    return csiFrames.slice(Math.max(0, csiCursor - 119), csiCursor + 1)
  }, [csiFrames, csiCursor])

  // ── Readiness ─────────────────────────────────────────────────────────────
  const canPlay = !!videoUrl ? videoReady : true

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl',
        className,
      )}
    >
      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">
              {session.tableName ?? `Table ${session.tableNumber}`}
            </p>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
              {session.recordingDate}
              {session.cameraNumber != null && <span className="ml-2">CAM #{session.cameraNumber}</span>}
              {session.micNumber != null && <span className="ml-1.5">MIC #{session.micNumber}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Main content: video + CSI side-by-side ───────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ─── Video pane ────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 bg-black">
          {videoUrl ? (
            videoError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Film className="w-10 h-10 opacity-30" />
                <p className="text-sm">{videoError}</p>
                <p className="text-[10px] font-mono opacity-50">{session.videoId}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                preload="metadata"
                playsInline
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onError={handleVideoError}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Film className="w-10 h-10 opacity-20" />
              <p className="text-sm">No video file in this session</p>
            </div>
          )}

          {/* Hidden audio element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              preload="metadata"
              onCanPlay={() => setAudioReady(true)}
              onError={handleAudioError}
              className="hidden"
            />
          )}
        </div>

        {/* ─── CSI Heatmap pane ──────────────────────────────────────────── */}
        <div className="w-72 shrink-0 bg-slate-950 border-l border-slate-800 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              WiFi CSI
            </span>
            {csiLoading && (
              <span className="text-[9px] text-slate-500 animate-pulse ml-1">loading…</span>
            )}
            {csiFrames.length > 0 && !csiLoading && (
              <span className="text-[9px] font-mono text-slate-600 ml-auto">
                {csiFrames.length} frames
              </span>
            )}
          </div>

          <div className="flex-1 flex items-start justify-center p-2 overflow-hidden">
            {csiError ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                <Radio className="w-8 h-8 opacity-20" />
                <p className="text-[11px] text-center px-4">{csiError}</p>
              </div>
            ) : csiFrames.length === 0 && !csiLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                <Radio className="w-8 h-8 opacity-20" />
                <p className="text-[11px] text-center px-4">
                  {session.nodeId
                    ? 'No CSI data for this session'
                    : 'No ESP32 node linked to this table'}
                </p>
              </div>
            ) : (
              <WifiHeatmap
                frames={visibleCsiFrames}
                width={248}
                height={280}
                maxRows={120}
                playbackCursor={visibleCsiFrames.length - 1}
              />
            )}
          </div>

          {/* Current frame info */}
          {csiFrames[csiCursor] && (
            <div className="px-3 py-1.5 border-t border-slate-800 text-[9px] font-mono text-slate-600">
              <div>frame {csiCursor + 1}/{csiFrames.length}</div>
              <div>ts: {new Date(csiFrames[csiCursor].ts * 1000).toLocaleTimeString('en-US', { hour12: false })}</div>
              {csiFrames[csiCursor].estimatedX !== undefined && (
                <div>pos: ({csiFrames[csiCursor].estimatedX?.toFixed(0)}, {csiFrames[csiCursor].estimatedY?.toFixed(0)})</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Audio waveform indicator bar ─────────────────────────────────── */}
      {audioUrl && !audioError && (
        <div className="h-7 bg-slate-900 border-t border-slate-800 flex items-center gap-2 px-4 shrink-0">
          <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
            Audio
          </span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            {/* Static indicator — audio is playing if not paused */}
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                playing ? 'bg-emerald-500 w-3/4' : 'bg-slate-600 w-1/4'
              )}
            />
          </div>
          {audioError && (
            <span className="text-[10px] text-red-400">{audioError}</span>
          )}
        </div>
      )}

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 shrink-0 flex flex-col gap-2">

        {/* Timeline scrubber */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!canPlay}
          className="w-full accent-cyan-500 cursor-pointer disabled:opacity-40"
        />

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Rewind */}
          <button
            onClick={() => seek(Math.max(0, currentTime - 10))}
            disabled={!canPlay}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!canPlay}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Time display */}
          <span className="text-xs font-mono text-slate-400 min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume slider (controls audio element) */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
            className="w-20 accent-cyan-500 cursor-pointer"
          />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
