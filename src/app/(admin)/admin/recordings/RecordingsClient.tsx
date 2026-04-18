'use client';

/**
 * RecordingsClient — Advanced Search & Playback Dashboard.
 *
 * Search form fields:
 *   • Center          (pre-filled from auth context)
 *   • Desk / Table    (dropdown from tables API)
 *   • Camera #        (number input)
 *   • Mic #           (number input)
 *   • Media Type      (VIDEO / AUDIO / WIFI_SENSING / All)
 *   • Date From / To  (date pickers)
 *   • Time From / To  (time pickers — combined with date for exact-time filter)
 *
 * Results:
 *   • Paginated table showing each LocalMedia record
 *   • "Play" button opens SyncPlayer in a modal overlay
 *   • SyncPlayer auto-loads sibling VIDEO + AUDIO files for the same
 *     table+date and attempts to load CSI data for the matching node
 *
 * Sync session assembly:
 *   When the user clicks Play on any result row, we look at the results set
 *   for matching records with the same tableId + recordingDate, then pass
 *   both videoId and audioId to SyncPlayer.
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  Search,
  Film,
  Mic,
  Radio,
  ChevronLeft,
  ChevronRight,
  Play,
  HardDrive,
  Filter,
  X,
  Calendar,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { localMediaApi, csiLogsApi, tablesApi, type LocalMediaSearchParams } from '@/lib/api';
import type { LocalMedia, LocalMediaPage, Table, MediaType } from '@/types';
import SyncPlayer, { type SyncSession } from '@/components/admin/SyncPlayer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number | string | bigint): string {
  const b = Number(n)
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(2)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

const MEDIA_ICON: Record<MediaType, React.ElementType> = {
  VIDEO: Film,
  AUDIO: Mic,
  WIFI_SENSING: Radio,
}

const MEDIA_COLORS: Record<MediaType, string> = {
  VIDEO: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  AUDIO: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  WIFI_SENSING: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecordingsClient() {
  const { user } = useAuth()
  const centerId = user?.centerId ?? ''

  // ── Tables for dropdown ────────────────────────────────────────────────
  const [tables, setTables] = useState<Table[]>([])
  useEffect(() => {
    if (!centerId) return
    tablesApi.getAll({ centerId })
      .then(({ data }) => setTables(data))
      .catch(console.error)
  }, [centerId])

  // ── ESP nodes for CSI (keyed by tableId) ──────────────────────────────
  // We use the csiLogs file listing to discover which nodeIds have data
  const [nodeByTable, setNodeByTable] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!centerId) return
    csiLogsApi.listFiles({ centerId })
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const f of data.files) {
          if (f.nodeId) map[f.tableId] = f.nodeId
        }
        setNodeByTable(map)
      })
      .catch(() => {})
  }, [centerId])

  // ── Search form state ─────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const [tableId, setTableId] = useState('')
  const [cameraNumber, setCameraNumber] = useState('')
  const [micNumber, setMicNumber] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | ''>('')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [timeFrom, setTimeFrom] = useState('00:00')
  const [timeTo, setTimeTo] = useState('23:59')
  const [page, setPage] = useState(1)
  const LIMIT = 20

  // ── Results ────────────────────────────────────────────────────────────
  const [results, setResults] = useState<LocalMediaPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (p = 1) => {
    if (!centerId) return
    setLoading(true)
    setError(null)
    try {
      const params: LocalMediaSearchParams = {
        centerId,
        page: p,
        limit: LIMIT,
      }
      if (tableId) params.tableId = tableId
      if (cameraNumber) params.cameraNumber = parseInt(cameraNumber)
      if (micNumber) params.micNumber = parseInt(micNumber)
      if (mediaType) params.mediaType = mediaType
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo

      const { data } = await localMediaApi.search(params)
      setResults(data)
      setPage(p)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [centerId, tableId, cameraNumber, micNumber, mediaType, dateFrom, dateTo])

  // Run on mount
  useEffect(() => { runSearch(1) }, [centerId]) // eslint-disable-line

  // ── Build a SyncSession from a clicked row ────────────────────────────
  const [syncSession, setSyncSession] = useState<SyncSession | null>(null)

  const openPlayer = useCallback((row: LocalMedia) => {
    // Find sibling records in the same results for same table+date
    const siblings = results?.data?.filter(
      (r) => r.tableId === row.tableId && r.recordingDate === row.recordingDate
    ) ?? [row]

    const videoRec = siblings.find((r) => r.mediaType === 'VIDEO')
    const audioRec = siblings.find((r) => r.mediaType === 'AUDIO')
    const nodeId = row.tableId ? nodeByTable[row.tableId] : undefined

    // Derive sessionStartTs from the file path name (table_{id}_cam_{n}_{YYYYMMDD_HHMMSS})
    // Fall back to midnight of recordingDate if we can't parse it
    let sessionStartTs = new Date(`${row.recordingDate}T${timeFrom}:00`).getTime() / 1000
    const tsMatch = row.absolutePath?.match(/(\d{8}_\d{6})/)
    if (tsMatch) {
      const [date, time] = [tsMatch[1].slice(0, 8), tsMatch[1].slice(9)]
      const y = date.slice(0, 4), mo = date.slice(4, 6), d = date.slice(6, 8)
      const hh = time.slice(0, 2), mm = time.slice(2, 4), ss = time.slice(4, 6)
      sessionStartTs = new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}`).getTime() / 1000
    }

    const tbl = tables.find((t) => t.id === row.tableId)
    setSyncSession({
      videoId: videoRec?.id ?? null,
      audioId: audioRec?.id ?? null,
      tableId: row.tableId ?? '_center',
      tableName: tbl?.name,
      tableNumber: tbl?.tableNumber,
      centerId,
      recordingDate: row.recordingDate,
      sessionStartTs,
      durationSec: videoRec?.durationSec ?? audioRec?.durationSec ?? null,
      nodeId: nodeId ?? null,
      cameraNumber: row.cameraNumber,
      micNumber: row.micNumber,
    })
  }, [results, tables, nodeByTable, centerId, timeFrom])

  // ── Stats banner ──────────────────────────────────────────────────────
  const totalFound = results?.meta?.total ?? 0

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Recordings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Search and replay saved video, audio, and WiFi sensing footage
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
          <HardDrive className="w-3.5 h-3.5" />
          {totalFound > 0 && <span>{totalFound} file{totalFound !== 1 ? 's' : ''} found</span>}
        </div>
      </div>

      {/* ── Search form ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filters</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">

          {/* Desk / Table */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Desk</label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 appearance-none"
            >
              <option value="">All desks</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (#{t.tableNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Camera # */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Camera #</label>
            <input
              type="number"
              min={1}
              value={cameraNumber}
              onChange={(e) => setCameraNumber(e.target.value)}
              placeholder="Any"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
            />
          </div>

          {/* Mic # */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Mic #</label>
            <input
              type="number"
              min={1}
              value={micNumber}
              onChange={(e) => setMicNumber(e.target.value)}
              placeholder="Any"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
            />
          </div>

          {/* Media type */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Type</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType | '')}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 appearance-none"
            >
              <option value="">All types</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="WIFI_SENSING">WiFi Sensing</option>
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" /> Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" /> Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>

          {/* Time range (exact time filter) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Time From
            </label>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Time To
            </label>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => runSearch(1)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            onClick={() => {
              setTableId(''); setCameraNumber(''); setMicNumber('')
              setMediaType(''); setDateFrom(today); setDateTo(today)
              setTimeFrom('00:00'); setTimeTo('23:59')
              runSearch(1)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {/* ── Results table ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider w-10">Type</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Desk</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Camera / Mic</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Size</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">Play</th>
            </tr>
          </thead>
          <tbody>
            {loading && !results && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-600">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-20 animate-pulse" />
                    <span>Searching…</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && results?.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-600">
                  <div className="flex flex-col items-center gap-2">
                    <HardDrive className="w-8 h-8 opacity-20" />
                    <span>No recordings found</span>
                  </div>
                </td>
              </tr>
            )}
            {results?.data?.map((row) => {
              const Icon = MEDIA_ICON[row.mediaType]
              const colors = MEDIA_COLORS[row.mediaType]
              const tbl = tables.find((t) => t.id === row.tableId)

              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded border text-[10px]', colors)}>
                      <Icon className="w-3 h-3" />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">
                    {tbl?.name ?? row.tableId ?? '—'}
                    {tbl && (
                      <span className="text-slate-600 ml-1.5">#{tbl.tableNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {row.cameraNumber != null && <span className="text-cyan-600">CAM {row.cameraNumber}</span>}
                    {row.cameraNumber != null && row.micNumber != null && <span className="mx-1 text-slate-700">·</span>}
                    {row.micNumber != null && <span className="text-emerald-600">MIC {row.micNumber}</span>}
                    {row.cameraNumber == null && row.micNumber == null && '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {row.recordingDate}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {row.durationSec != null
                      ? `${Math.floor(row.durationSec / 60)}m ${Math.floor(row.durationSec % 60)}s`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {formatBytes(row.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.mediaType !== 'WIFI_SENSING' && (
                      <button
                        onClick={() => openPlayer(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700/40 hover:bg-cyan-700 border border-cyan-700/40 text-cyan-300 hover:text-white text-[11px] font-semibold transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" />
                        Play
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {results && results.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Page {results.meta.page} of {results.meta.totalPages} &nbsp;·&nbsp; {results.meta.total} total
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => runSearch(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => runSearch(page + 1)}
              disabled={page >= results.meta.totalPages || loading}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── SyncPlayer modal overlay ─────────────────────────────────────── */}
      {syncSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <SyncPlayer
            session={syncSession}
            onClose={() => setSyncSession(null)}
            className="w-full max-w-5xl max-h-[90vh]"
          />
        </div>
      )}
    </div>
  )
}
