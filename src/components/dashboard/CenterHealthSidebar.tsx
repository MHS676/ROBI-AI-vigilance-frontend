'use client';

/**
 * CenterHealthSidebar — Device Connectivity Health for all 105 centers.
 *
 * Shows a scrollable list of centers with:
 *  • Status dot (ONLINE / OFFLINE / MAINTENANCE)
 *  • Camera health bar  (online / total)
 *  • WiFi node health bar
 *  • Mic level indicator
 *  • Last activity timestamp
 *
 * Data sources:
 *  1. Zustand centerStatus — live MQTT-driven per-center status updates
 *  2. Loaded device counts from the backend (cameras/esp-nodes/microphones)
 *     fetched once per mount, then kept fresh via the WS offline events.
 *
 * If a center has never broadcast any WS event its status defaults to ONLINE
 * with "—" timestamps.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Camera,
  Wifi,
  Mic,
  Clock,
  Activity,
  AlertCircle,
  Wrench,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAlertsStore, type CenterStatusEntry } from '@/store/alerts.store';
import { centersApi, camerasApi, espNodesApi, microphonesApi } from '@/lib/api';
import type { Center } from '@/types';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CenterDeviceCounts {
  camerasOnline: number;
  camerasTotal: number;
  wifiOnline: number;
  wifiTotal: number;
  micsOnline: number;
  micsTotal: number;
}

// ─── Mini health bar ──────────────────────────────────────────────────────────
function HealthBar({
  online,
  total,
  color = 'bg-emerald-500',
}: {
  online: number;
  total: number;
  color?: string;
}) {
  if (total === 0) return <span className="text-[10px] text-slate-600">—</span>;
  const pct = Math.round((online / total) * 100);
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-amber-500'   :
                'bg-red-500';
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[32px]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-slate-400 shrink-0">
        {online}/{total}
      </span>
    </div>
  );
}

// ─── Status dot ──────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: CenterStatusEntry['status'] | 'UNKNOWN' }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full shrink-0',
      status === 'ONLINE'      ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : '',
      status === 'OFFLINE'     ? 'bg-red-500 animate-pulse' : '',
      status === 'MAINTENANCE' ? 'bg-amber-500' : '',
      status === 'UNKNOWN'     ? 'bg-slate-600' : '',
    )} />
  );
}

// ─── Row icon for status ──────────────────────────────────────────────────────
function StatusIcon({ status }: { status: CenterStatusEntry['status'] | 'UNKNOWN' }) {
  switch (status) {
    case 'ONLINE':      return <Activity className="w-3 h-3 text-emerald-400" />;
    case 'OFFLINE':     return <AlertCircle className="w-3 h-3 text-red-400" />;
    case 'MAINTENANCE': return <Wrench className="w-3 h-3 text-amber-400" />;
    default:            return <Activity className="w-3 h-3 text-slate-600" />;
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)      return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000)   return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000)  return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CenterHealthSidebar({ className }: { className?: string }) {
  const centerStatus = useAlertsStore((s) => s.centerStatus);

  // ── Centers list ────────────────────────────────────────────────────────────
  const [centers,   setCenters]   = useState<Center[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Device counts per center ─────────────────────────────────────────────
  const [deviceCounts, setDeviceCounts] = useState<Record<string, CenterDeviceCounts>>({});

  // ── Search / filter ──────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'>('ALL');

  // ── Load all centers + device counts ────────────────────────────────────────
  const loadData = async () => {
    try {
      setRefreshing(true);
      const { data: centerList } = await centersApi.getAll({ isActive: true });
      setCenters(centerList);

      // Fetch cameras, wifi nodes, mics in parallel
      const [camsRes, wifiRes, micsRes] = await Promise.all([
        camerasApi.getAll(),
        espNodesApi.getAll(),
        microphonesApi.getAll(),
      ]);

      const counts: Record<string, CenterDeviceCounts> = {};
      for (const c of centerList) {
        counts[c.id] = {
          camerasOnline: 0, camerasTotal: 0,
          wifiOnline: 0,    wifiTotal: 0,
          micsOnline: 0,    micsTotal: 0,
        };
      }

      for (const cam of camsRes.data) {
        const entry = counts[cam.centerId];
        if (!entry) continue;
        entry.camerasTotal++;
        if ((cam as { status?: string }).status === 'ONLINE' || !(cam as { status?: string }).status) {
          entry.camerasOnline++;
        }
      }

      for (const node of wifiRes.data) {
        const entry = counts[(node as { centerId: string }).centerId];
        if (!entry) continue;
        entry.wifiTotal++;
        if ((node as { status?: string }).status === 'ONLINE' || !(node as { status?: string }).status) {
          entry.wifiOnline++;
        }
      }

      for (const mic of micsRes.data) {
        const entry = counts[(mic as { centerId: string }).centerId];
        if (!entry) continue;
        entry.micsTotal++;
        if ((mic as { status?: string }).status === 'ONLINE' || !(mic as { status?: string }).status) {
          entry.micsOnline++;
        }
      }

      setDeviceCounts(counts);
    } catch (err) {
      console.error('[CenterHealthSidebar] load failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Merge centers with live status ─────────────────────────────────────────
  const enrichedCenters = useMemo(() => {
    return centers.map((c) => ({
      center:  c,
      status:  (centerStatus[c.id]?.status ?? 'UNKNOWN') as CenterStatusEntry['status'] | 'UNKNOWN',
      lastSeen: centerStatus[c.id]?.lastSeen,
      devices: deviceCounts[c.id] ?? { camerasOnline: 0, camerasTotal: 0, wifiOnline: 0, wifiTotal: 0, micsOnline: 0, micsTotal: 0 },
    }));
  }, [centers, centerStatus, deviceCounts]);

  // ── Filter + search ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = enrichedCenters;
    if (filterStatus !== 'ALL') {
      rows = rows.filter((r) => r.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.center.name.toLowerCase().includes(q) ||
          r.center.code.toLowerCase().includes(q),
      );
    }
    // Sort: OFFLINE first, then MAINTENANCE, then ONLINE, then UNKNOWN
    const ORDER = { OFFLINE: 0, MAINTENANCE: 1, ONLINE: 2, UNKNOWN: 3 };
    return rows.sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3));
  }, [enrichedCenters, filterStatus, search]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    total:       enrichedCenters.length,
    online:      enrichedCenters.filter((r) => r.status === 'ONLINE').length,
    offline:     enrichedCenters.filter((r) => r.status === 'OFFLINE').length,
    maintenance: enrichedCenters.filter((r) => r.status === 'MAINTENANCE').length,
  }), [enrichedCenters]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn('card flex flex-col min-h-0', className)}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white">Device Health</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {summary.online} online · {summary.offline > 0 ? <span className="text-red-400">{summary.offline} offline</span> : '0 offline'} · {summary.total} total
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 shrink-0 border-b border-slate-800">
        {(['ALL', 'ONLINE', 'OFFLINE', 'MAINTENANCE'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors',
              filterStatus === s
                ? s === 'ALL'         ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : s === 'ONLINE'      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : s === 'OFFLINE'     ? 'bg-red-500/20 border-red-500/40 text-red-400'
                :                       'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600',
            )}
          >
            {s === 'ALL' ? `All ${summary.total}` : s}
            {s === 'OFFLINE' && summary.offline > 0 && (
              <span className="ml-1 px-1 rounded-full bg-red-500 text-white text-[8px]">{summary.offline}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search box */}
      <div className="px-4 py-2 shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search center…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-600 outline-none"
          />
        </div>
      </div>

      {/* Center rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs">
            <Activity className="w-6 h-6 mb-2 opacity-40" />
            No centers match
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map(({ center, status, lastSeen, devices }) => (
              <div
                key={center.id}
                className={cn(
                  'px-4 py-3 hover:bg-slate-800/40 transition-colors',
                  status === 'OFFLINE' && 'bg-red-900/10',
                )}
              >
                {/* Row header */}
                <div className="flex items-center gap-2 mb-2">
                  <StatusDot status={status} />
                  <span className="text-xs font-semibold text-white truncate flex-1 min-w-0">
                    {center.name}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono shrink-0">{center.code}</span>
                  <StatusIcon status={status} />
                </div>

                {/* Device health bars */}
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {/* Cameras */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-[9px] text-slate-600">CAM</span>
                    </div>
                    <HealthBar online={devices.camerasOnline} total={devices.camerasTotal} />
                  </div>

                  {/* WiFi Nodes */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <Wifi className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-[9px] text-slate-600">WIFI</span>
                    </div>
                    <HealthBar online={devices.wifiOnline} total={devices.wifiTotal} />
                  </div>

                  {/* Microphones */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <Mic className="w-2.5 h-2.5 text-slate-500" />
                      <span className="text-[9px] text-slate-600">MIC</span>
                    </div>
                    <HealthBar online={devices.micsOnline} total={devices.micsTotal} />
                  </div>
                </div>

                {/* Last seen */}
                {lastSeen && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="w-2.5 h-2.5 text-slate-600" />
                    <span className="text-[9px] text-slate-600">{relativeTime(lastSeen)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-800 shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">
          Showing {filtered.length} of {summary.total}
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {summary.online}
          </span>
          {summary.offline > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {summary.offline}
            </span>
          )}
          {summary.maintenance > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {summary.maintenance}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
