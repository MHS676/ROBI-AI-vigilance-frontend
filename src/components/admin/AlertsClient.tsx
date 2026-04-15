'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  BellRing,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  ZoomIn,
} from 'lucide-react';
import { alertsApi, type AlertsQuery } from '@/lib/api';
import type { Alert, AlertSeverity, AlertType } from '@/types';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & METADATA
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const ALERT_TYPES: AlertType[] = [
  'WEAPON', 'FIGHT', 'FALL', 'FIRE', 'CROWD',
  'HIGH_AUDIO', 'WIFI_FALL', 'DEVICE_OFFLINE',
];

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  CRITICAL: {
    label:  'Critical',
    dot:    'bg-red-400',
    text:   'text-red-400',
    bg:     'bg-red-400/10',
    border: 'border-red-500/30',
  },
  HIGH: {
    label:  'High',
    dot:    'bg-orange-400',
    text:   'text-orange-400',
    bg:     'bg-orange-400/10',
    border: 'border-orange-500/30',
  },
  MEDIUM: {
    label:  'Medium',
    dot:    'bg-amber-400',
    text:   'text-amber-400',
    bg:     'bg-amber-400/10',
    border: 'border-amber-500/30',
  },
  LOW: {
    label:  'Low',
    dot:    'bg-sky-400',
    text:   'text-sky-400',
    bg:     'bg-sky-400/10',
    border: 'border-sky-500/30',
  },
  INFO: {
    label:  'Info',
    dot:    'bg-slate-400',
    text:   'text-slate-400',
    bg:     'bg-slate-700',
    border: 'border-slate-600',
  },
};

const TYPE_META: Record<AlertType, { label: string; icon: string }> = {
  WEAPON:         { label: 'Weapon Detected',   icon: '🔫' },
  FIGHT:          { label: 'Fight / Aggression', icon: '⚠️' },
  FALL:           { label: 'Camera Fall',        icon: '🚨' },
  FIRE:           { label: 'Fire & Smoke',        icon: '🔥' },
  CROWD:          { label: 'Overcrowding',        icon: '👥' },
  HIGH_AUDIO:     { label: 'High Audio Level',   icon: '🔊' },
  WIFI_FALL:      { label: 'WiFi CSI Fall',      icon: '📡' },
  DEVICE_OFFLINE: { label: 'Device Offline',     icon: '🔴' },
};

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — format timestamp
// ─────────────────────────────────────────────────────────────────────────────
function fmtTs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const m = SEVERITY_META[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        m.text, m.bg, m.border,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', m.dot)} />
      {m.label}
    </span>
  );
}

function TypeBadge({ type }: { type: AlertType }) {
  const m = TYPE_META[type] ?? { label: type, icon: '❓' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 border border-slate-600 text-slate-200">
      <span className="text-[11px] leading-none">{m.icon}</span>
      {m.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 85 ? 'bg-red-500' :
    pct >= 65 ? 'bg-orange-400' :
    pct >= 40 ? 'bg-amber-400' :
    'bg-sky-500';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenceModalProps {
  alert: Alert;
  onClose: () => void;
}

function EvidenceModal({ alert, onClose }: EvidenceModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { date, time } = fmtTs(alert.timestamp);
  const typeMeta   = TYPE_META[alert.type]     ?? { label: alert.type,     icon: '❓' };
  const sevMeta    = SEVERITY_META[alert.severity];

  // Close on backdrop click
  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Evidence Frame</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {date} · {time}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Alert metadata strip ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[13px]">{typeMeta.icon}</span>
            <span className={cn('font-medium', sevMeta.text)}>{typeMeta.label}</span>
          </div>
          <SeverityBadge severity={alert.severity} />
          {alert.center && (
            <span className="text-xs text-slate-400">
              📍 {alert.center.name}
              <span className="ml-1 text-slate-600">({alert.center.code})</span>
            </span>
          )}
          {alert.table && (
            <span className="text-xs text-slate-400">
              🪑 {alert.table.name}
            </span>
          )}
          <span className="text-xs text-slate-400">
            🎯 Confidence: <span className="text-white font-medium">{Math.round(alert.confidence * 100)}%</span>
          </span>
          {alert.camera && (
            <span className="text-xs text-slate-400">
              📷 {alert.camera.name}
            </span>
          )}
        </div>

        {/* ── Evidence image ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-5 flex items-center justify-center bg-black/40">
          {alert.imageUrl ? (
            <div className="relative group w-full">
              <Image
                src={alert.imageUrl}
                alt={`Evidence frame — ${typeMeta.label} at ${alert.center?.name ?? ''}`}
                width={1280}
                height={720}
                className="w-full h-auto rounded-xl border border-slate-700 object-contain max-h-[55vh]"
                unoptimized // S3 presigned URLs — skip Next.js image optimization
              />
              {/* Open original link */}
              <a
                href={alert.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity',
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white',
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open original
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <ZoomIn className="w-10 h-10 opacity-30" />
              <p className="text-sm">No evidence frame available for this alert</p>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-600 font-mono">ID: {alert.id}</span>
          <button
            onClick={onClose}
            className="px-4 h-8 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR SUB-COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  dateFrom:  string;
  dateTo:    string;
  severity:  string;
  alertType: string;
  search:    string;
}

interface FilterBarProps {
  filters:    FilterState;
  onChange:   (next: Partial<FilterState>) => void;
  onReset:    () => void;
  loading:    boolean;
  onRefresh:  () => void;
  totalCount: number;
}

function FilterBar({ filters, onChange, onReset, loading, onRefresh, totalCount }: FilterBarProps) {
  const hasActiveFilters =
    filters.dateFrom || filters.dateTo || filters.severity ||
    filters.alertType || filters.search;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {/* ── Row 1: Label + Actions ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-sm font-semibold text-white">Filters</span>
          {hasActiveFilters && (
            <span className="text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 tabular-nums">{totalCount.toLocaleString()} alerts</span>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <X className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Row 2: All inputs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Date From */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">From</label>
          <div className="relative">
            <CalendarRange className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">To</label>
          <div className="relative">
            <CalendarRange className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="datetime-local"
              value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">Severity</label>
          <select
            value={filters.severity}
            onChange={(e) => onChange({ severity: e.target.value })}
            className="w-full h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
          >
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{SEVERITY_META[s].label}</option>
            ))}
          </select>
        </div>

        {/* Alert Type */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">Alert Type</label>
          <select
            value={filters.alertType}
            onChange={(e) => onChange({ alertType: e.target.value })}
            className="w-full h-9 px-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
          >
            <option value="">All types</option>
            {ALERT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
            ))}
          </select>
        </div>

        {/* Free text search (center / table name) */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Center or table…"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: FilterState = {
  dateFrom:  '',
  dateTo:    '',
  severity:  '',
  alertType: '',
  search:    '',
};

export default function AlertsClient() {
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [total,  setTotal]      = useState(0);
  const [page,   setPage]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [filters, setFilters]   = useState<FilterState>(EMPTY_FILTERS);
  const [evidence, setEvidence] = useState<Alert | null>(null);

  // ── Debounce filter changes ───────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAlerts = useCallback(async (f: FilterState, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: AlertsQuery = {
        page:  pg,
        limit: PAGE_SIZE,
        ...(f.severity  ? { severity: f.severity }   : {}),
        ...(f.alertType ? { type:     f.alertType }   : {}),
        ...(f.dateFrom  ? { dateFrom: new Date(f.dateFrom).toISOString() } : {}),
        ...(f.dateTo    ? { dateTo:   new Date(f.dateTo).toISOString()   } : {}),
      };
      const { data: res } = await alertsApi.getAll(params);

      // Client-side free-text filter (center name / table name)
      let rows = res.data;
      if (f.search.trim()) {
        const q = f.search.toLowerCase();
        rows = rows.filter(
          (a) =>
            a.center?.name?.toLowerCase().includes(q) ||
            a.center?.code?.toLowerCase().includes(q) ||
            a.table?.name?.toLowerCase().includes(q),
        );
      }

      setAlerts(rows);
      setTotal(res.meta.total);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to load alerts. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch when page changes
  useEffect(() => {
    fetchAlerts(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Debounced fetch when filters change (reset to page 1)
  const handleFilterChange = (next: Partial<FilterState>) => {
    const updated = { ...filters, ...next };
    setFilters(updated);
    setPage(1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAlerts(updated, 1);
    }, 400);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    fetchAlerts(EMPTY_FILTERS, 1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <BellRing className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Historical Evidence Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Persisted AI / sensor alerts with evidence frames
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="text-slate-400 font-medium tabular-nums">{total.toLocaleString()}</span> total alerts in DB
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        loading={loading}
        onRefresh={() => fetchAlerts(filters, page)}
        totalCount={total}
      />

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-xl text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Center</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Table</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Alert Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Severity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Confidence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading skeleton */}
              {loading && (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-slate-800 animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {/* Empty state */}
              {!loading && alerts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <BellRing className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No alerts found matching the current filters</p>
                      <button
                        onClick={handleReset}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && alerts.map((alert) => {
                const { date, time } = fmtTs(alert.timestamp);
                const sevMeta  = SEVERITY_META[alert.severity];
                const hasImage = Boolean(alert.imageUrl);

                return (
                  <tr
                    key={alert.id}
                    className={cn(
                      'border-b border-slate-800/50 transition-colors',
                      'hover:bg-slate-800/30',
                      alert.severity === 'CRITICAL' && 'border-l-2 border-l-red-500/70',
                    )}
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-slate-300 font-medium">{date}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{time}</div>
                    </td>

                    {/* Center */}
                    <td className="px-4 py-3">
                      {alert.center ? (
                        <div>
                          <div className="text-xs font-medium text-slate-200 truncate max-w-[160px]">
                            {alert.center.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {alert.center.code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Table */}
                    <td className="px-4 py-3">
                      {alert.table ? (
                        <div className="text-xs text-slate-300 truncate max-w-[140px]">
                          {alert.table.name}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Alert Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TypeBadge type={alert.type} />
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SeverityBadge severity={alert.severity} />
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3">
                      <ConfidenceBar value={alert.confidence} />
                    </td>

                    {/* Evidence */}
                    <td className="px-4 py-3">
                      {hasImage ? (
                        <button
                          onClick={() => setEvidence(alert)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 h-7 rounded-lg',
                            'text-xs font-medium transition-all',
                            'bg-cyan-500/10 hover:bg-cyan-500/20',
                            'border border-cyan-500/30 hover:border-cyan-400/50',
                            'text-cyan-400 hover:text-cyan-300',
                          )}
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          View Evidence
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">No frame</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ──────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40">
            <span className="text-xs text-slate-500">
              Page <span className="text-slate-300 font-medium">{page}</span> of{' '}
              <span className="text-slate-300 font-medium">{totalPages}</span>
              {' '}·{' '}{total.toLocaleString()} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none border border-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-xs font-medium transition-colors border',
                      pg === page
                        ? 'bg-cyan-500 border-cyan-500 text-slate-950 font-bold'
                        : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800',
                    )}
                  >
                    {pg}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none border border-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Evidence modal ──────────────────────────────────────────────── */}
      {evidence && (
        <EvidenceModal alert={evidence} onClose={() => setEvidence(null)} />
      )}

      {/* Loading overlay (full page) on initial load */}
      {loading && alerts.length === 0 && !error && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading alerts…</span>
        </div>
      )}
    </div>
  );
}
