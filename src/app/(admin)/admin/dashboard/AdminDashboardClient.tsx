'use client';

/**
 * AdminDashboardClient — 60/40 real-time admin dashboard.
 *
 * Left 60%  — LiveVideoPlayer (HLS/RTSP, AI overlay, camera switcher)
 * Right 40% — TableStatusCards (real-time AI + WiFi + Audio per table)
 *
 * WebSocket event wiring:
 *   update:ai_results   → updateTableAiResult
 *   update:wifi_sensing → updateTableWifiResult
 *   update:audio_level  → updateTableAudioLevel
 *   alert:*             → addAlert (feed / badge counter)
 */

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Layers,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useAlertsStore } from '@/store/alerts.store';
import { useSocket } from '@/hooks/useSocket';
import { centersApi } from '@/lib/api';
import LiveVideoPlayer from '@/components/admin/LiveVideoPlayer';
import TableStatusCard  from '@/components/admin/TableStatusCard';
import type { Camera, Table } from '@/types';
import type { AiResultPayload, WifiSensingPayload, AudioLevelPayload, WsEventEnvelope } from '@/types';

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboardClient() {
  const user       = useAuthStore((s) => s.user);
  const centerId   = user?.centerId ?? '';

  // ── Remote data ─────────────────────────────────────────────────────────────
  const [cameras,       setCameras]      = useState<Camera[]>([]);
  const [tables,        setTables]       = useState<Table[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [loadError,     setLoadError]    = useState<string | null>(null);

  // ── Store ────────────────────────────────────────────────────────────────────
  const tableStatuses      = useAlertsStore((s) => s.tableStatuses);
  const unreadCount        = useAlertsStore((s) => s.unreadCount);
  const addAlert           = useAlertsStore((s) => s.addAlert);
  const updateTableAi      = useAlertsStore((s) => s.updateTableAiResult);
  const updateTableWifi    = useAlertsStore((s) => s.updateTableWifiResult);
  const updateTableAudio   = useAlertsStore((s) => s.updateTableAudioLevel);
  const markRead           = useAlertsStore((s) => s.markRead);

  // ── Socket ───────────────────────────────────────────────────────────────────
  const { on, isConnected } = useSocket();

  // ── Fetch cameras + tables on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!centerId) return;
    setLoading(true);

    Promise.all([
      centersApi.getCameras(centerId),
      centersApi.getTables(centerId),
    ])
      .then(([camRes, tableRes]) => {
        setCameras(camRes.data);
        setTables(tableRes.data);
      })
      .catch(() => setLoadError('Could not load center data. Check your API connection.'))
      .finally(() => setLoading(false));
  }, [centerId]);

  // ── Subscribe to WebSocket events ────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      // Table-level real-time updates
      on<WsEventEnvelope<AiResultPayload>>('update:ai_results', (env) => {
        updateTableAi(env);
      }),
      on<WsEventEnvelope<WifiSensingPayload>>('update:wifi_sensing', (env) => {
        updateTableWifi(env);
      }),
      on<WsEventEnvelope<AudioLevelPayload>>('update:audio_level', (env) => {
        updateTableAudio(env);
      }),
      // Alert events → global feed + unread counter
      on('alert:fall_detected',       (env) => addAlert('alert:fall_detected',       env as WsEventEnvelope)),
      on('alert:aggression_detected', (env) => addAlert('alert:aggression_detected', env as WsEventEnvelope)),
      on('alert:high_audio_level',    (env) => addAlert('alert:high_audio_level',    env as WsEventEnvelope)),
      on('alert:crowd_detected',      (env) => addAlert('alert:crowd_detected',      env as WsEventEnvelope)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, updateTableAi, updateTableWifi, updateTableAudio, addAlert]);

  // ── Alert count in page title ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.title = unreadCount > 0
      ? `(${unreadCount}) Center Dashboard | Falcon`
      : 'Center Dashboard | Falcon';
  }, [unreadCount]);

  // ── Active alert count across tables ─────────────────────────────────────────
  const activeAlertCount = Object.values(tableStatuses).filter(
    (t) => t.centerId === centerId && (t.isFallDetected || t.isAggressionDetected || t.isAudioAlert),
  ).length;

  // ── Table cards sorted: alerts first, then tables with customers, then idle ──
  const sortedTables = [...tables].sort((a, b) => {
    const sa = tableStatuses[a.id];
    const sb = tableStatuses[b.id];
    const alertScore = (s?: typeof sa) =>
      s ? (s.isFallDetected ? 3 : 0) + (s.isAggressionDetected ? 2 : 0) + (s.isAudioAlert ? 1 : 0) : 0;
    return alertScore(sb) - alertScore(sa);
  });

  // ─── Loading / error states ───────────────────────────────────────────────────
  if (!centerId) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No center assigned to your account. Contact your Super Admin.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading center data…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm text-slate-300">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 px-4 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Center Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live monitoring · {cameras.length} camera{cameras.length !== 1 ? 's' : ''} · {tables.length} table{tables.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Active alerts badge */}
          {activeAlertCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-400 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {activeAlertCount} alert{activeAlertCount !== 1 ? 's' : ''} active
            </div>
          )}

          {/* Unread events badge */}
          {unreadCount > 0 && (
            <button
              onClick={markRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/8 border border-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/15 transition-colors"
            >
              <Activity className="w-3 h-3" />
              {unreadCount} new event{unreadCount !== 1 ? 's' : ''}
            </button>
          )}

          {/* WS status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border
            ${isConnected
              ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-800 border-slate-700 text-slate-500'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {isConnected ? 'Live' : 'Connecting…'}
          </div>
        </div>
      </div>

      {/* ── 60 / 40 content row ────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── LEFT 60% — Video Player ──────────────────────────────────────── */}
        <div className="w-[60%] shrink-0 flex flex-col min-h-0">
          <LiveVideoPlayer cameras={cameras} centerId={centerId} />
        </div>

        {/* ── RIGHT 40% — Table Status Cards ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Table Status</span>
              <span className="text-xs text-slate-500">({tables.length})</span>
            </div>
            {/* Live activity count */}
            {Object.keys(tableStatuses).length > 0 && (
              <span className="text-[10px] text-slate-500">
                {Object.values(tableStatuses).filter((t) => t.centerId === centerId && t.wifiCustomerPresent).length} occupied
              </span>
            )}
          </div>

          {/* Cards grid — scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
            {tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm gap-2">
                <Table2 className="w-8 h-8 opacity-30" />
                <p>No tables configured for this center</p>
              </div>
            ) : (
              sortedTables.map((table) => (
                <TableStatusCard
                  key={table.id}
                  table={table}
                  status={tableStatuses[table.id]}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
