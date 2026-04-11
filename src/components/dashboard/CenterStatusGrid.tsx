'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Building2, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { centersApi } from '@/lib/api';
import { useAlertsStore } from '@/store/alerts.store';
import type { Center } from '@/types';
import type { CenterStatusEntry } from '@/store/alerts.store';
import { cn } from '@/lib/utils';

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Single center card ───────────────────────────────────────────────────────
function CenterCard({
  center,
  liveStatus,
}: {
  center: Center;
  liveStatus: CenterStatusEntry | undefined;
}) {
  const statusVal  = liveStatus?.status;
  const isOnline   = statusVal === 'ONLINE';
  const isOffline  = statusVal === 'OFFLINE';
  const isMaint    = statusVal === 'MAINTENANCE';
  const isActive   = center.isActive;

  return (
    <Link
      href={`/super-admin/centers/${center.id}`}
      className={cn(
        'card p-3.5 hover:border-slate-600 transition-all duration-200 cursor-pointer group block',
        isOnline && 'border-emerald-500/30 hover:border-emerald-500/50 bg-slate-800',
        isOffline && 'border-red-500/30 hover:border-red-500/50',
        isMaint   && 'border-amber-500/20',
      )}
    >
      {/* Top row: code chip + status dot */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
          {center.code}
        </span>
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full shrink-0 transition-colors',
            isOnline  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : '',
            isOffline ? 'bg-red-400' : '',
            isMaint   ? 'bg-amber-400' : '',
            !statusVal && isActive  ? 'bg-slate-500' : '',
            !statusVal && !isActive ? 'bg-slate-700' : '',
          )}
        />
      </div>

      {/* Center name */}
      <p className="text-xs font-semibold text-white leading-tight truncate group-hover:text-cyan-300 transition-colors">
        {center.name}
      </p>

      {/* City */}
      <div className="flex items-center gap-1 mt-1.5">
        <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="text-[10px] text-slate-500 truncate">
          {center.city ?? center.state ?? '—'}
        </span>
      </div>

      {/* Live status line */}
      {liveStatus ? (
        <div className="mt-2 flex items-center gap-1">
          {isOnline ? (
            <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-500 shrink-0" />
          )}
          <span
            className={cn(
              'text-[10px] font-medium truncate',
              isOnline  ? 'text-emerald-400' : '',
              isOffline ? 'text-red-400'     : '',
              isMaint   ? 'text-amber-400'   : '',
            )}
          >
            {liveStatus.deviceType
              ? `${liveStatus.deviceType} · ${statusVal?.toLowerCase()}`
              : statusVal?.toLowerCase()}
            {' '}· {relativeTime(liveStatus.lastSeen)}
          </span>
        </div>
      ) : (
        <div className="mt-2">
          <span className="text-[10px] text-slate-700">
            {isActive ? 'Awaiting data…' : 'Inactive'}
          </span>
        </div>
      )}
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CenterStatusGrid() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'INACTIVE'>('ALL');

  const centerStatus = useAlertsStore((s) => s.centerStatus);

  // ── Fetch centers ────────────────────────────────────────────────────────────
  const fetchCenters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await centersApi.getAll();
      setCenters(data);
    } catch {
      setError('Failed to load centers. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCenters(); }, [fetchCenters]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const onlineCount   = Object.values(centerStatus).filter((s) => s.status === 'ONLINE').length;
  const offlineCount  = Object.values(centerStatus).filter((s) => s.status === 'OFFLINE').length;
  const maintCount    = Object.values(centerStatus).filter((s) => s.status === 'MAINTENANCE').length;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = centers.filter((c) => {
    if (filter === 'ALL')      return true;
    if (filter === 'INACTIVE') return !c.isActive;
    const ls = centerStatus[c.id];
    if (filter === 'ONLINE')   return ls?.status === 'ONLINE';
    if (filter === 'OFFLINE')  return ls?.status === 'OFFLINE';
    return true;
  });

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-72 bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Building2 className="w-8 h-8 text-slate-600" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchCenters}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary + filters ─────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-3">
        {/* Stat chips */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="font-semibold text-white">{centers.length}</span> total
          </span>
          <span className="w-px h-4 bg-slate-700" />
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 font-semibold">{onlineCount}</span>
            <span className="text-slate-500">online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-400 font-semibold">{offlineCount}</span>
            <span className="text-slate-500">offline</span>
          </span>
          {maintCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-400 font-semibold">{maintCount}</span>
              <span className="text-slate-500">maint.</span>
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="ml-auto flex gap-1">
          {(['ALL', 'ONLINE', 'OFFLINE', 'INACTIVE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-medium rounded-lg uppercase tracking-wide transition-all',
                filter === f
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800',
              )}
            >
              {f}
            </button>
          ))}

          {/* Refresh */}
          <button
            onClick={fetchCenters}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
            aria-label="Refresh centers"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2 text-slate-600">
            <Building2 className="w-8 h-8" />
            <p className="text-sm">No centers match this filter</p>
          </div>
        ) : (
          filtered.map((center) => (
            <CenterCard
              key={center.id}
              center={center}
              liveStatus={centerStatus[center.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
