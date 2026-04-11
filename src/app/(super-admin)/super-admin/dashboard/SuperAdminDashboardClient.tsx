'use client';

/**
 * SuperAdminDashboardClient
 * ─────────────────────────
 * Client component that:
 *  1. Creates/reuses the singleton socket via useSocket()
 *  2. Subscribes to ALL backend WS events in one useEffect
 *  3. Routes each event to the correct Zustand store action
 *  4. Renders the two-panel layout:
 *       ┌─────────────────────────────────────┬──────────────┐
 *       │  CenterStatusGrid (105 centers)      │  LiveAlerts  │
 *       │  Updates via update:device_status    │  Feed (right)│
 *       └─────────────────────────────────────┴──────────────┘
 *
 * Socket rooms (managed by the backend EventsGateway):
 *   SUPER_ADMIN → automatically joined to room:super_admin on connect.
 *   The server emits every center's events to this room, so the dashboard
 *   receives data from ALL 105 centers without additional client-side work.
 */

import { useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Loader2,
  Building2,
  ShieldCheck,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

import { useSocket } from '@/hooks/useSocket';
import {
  useAlertsStore,
  ALERT_EVENTS,
  type OfflineDeviceAlert,
} from '@/store/alerts.store';
import type { WsEventEnvelope } from '@/types';
import { cn } from '@/lib/utils';

import LiveAlertsFeed   from '@/components/dashboard/LiveAlertsFeed';
import CenterStatusGrid from '@/components/dashboard/CenterStatusGrid';

// ─── Offline device banner ────────────────────────────────────────────────────
function OfflineDeviceBanner({ device, onDismiss }: { device: OfflineDeviceAlert; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-red-900/40 border border-red-600/50 text-red-200 text-sm">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
      <span className="flex-1 min-w-0">
        <span className="font-semibold text-red-300">
          {device.deviceType === 'CAMERA' ? '📷' : '📡'}{' '}
          {device.deviceName ?? device.deviceId}
        </span>
        <span className="text-red-400"> went </span>
        <span className="font-bold text-red-300">OFFLINE</span>
        {device.ipAddress && (
          <span className="text-red-500 font-mono text-xs ml-1">({device.ipAddress})</span>
        )}
        <span className="text-red-500 ml-1">— {device.centerName}</span>
      </span>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-red-800/60 transition"
        title="Dismiss"
      >
        <XCircle className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

// ─── Connection status pill ───────────────────────────────────────────────────
function ConnectionBadge({ status }: { status: string }) {
  const isConnected   = status === 'connected';
  const isTransient   = status === 'connecting' || status === 'reconnecting';
  const isError       = status === 'error' || status === 'disconnected';

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border select-none',
        isConnected ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : '',
        isTransient ? 'text-amber-400  bg-amber-400/10  border-amber-400/20'  : '',
        isError     ? 'text-red-400    bg-red-400/10    border-red-400/20'    : '',
        status === 'idle' ? 'text-slate-500 bg-slate-500/10 border-slate-700' : '',
      )}
    >
      {isConnected && (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </>
      )}
      {isTransient && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="capitalize">{status}…</span>
        </>
      )}
      {(isError || status === 'idle') && (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span className="capitalize">{status === 'idle' ? 'Disconnected' : status}</span>
        </>
      )}
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip() {
  const alerts      = useAlertsStore((s) => s.alerts);
  const centerStatus = useAlertsStore((s) => s.centerStatus);

  const onlineCount   = Object.values(centerStatus).filter((s) => s.status === 'ONLINE').length;
  const offlineCount  = Object.values(centerStatus).filter((s) => s.status === 'OFFLINE').length;
  const criticalCount = alerts.filter(
    (a) => a.severity === 'CRITICAL' || a.severity === 'HIGH',
  ).length;

  const tiles = [
    {
      label: 'Total Centers',
      value: '105',
      icon: Building2,
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
    },
    {
      label: 'Devices Online',
      value: String(onlineCount),
      icon: Wifi,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'Devices Offline',
      value: String(offlineCount),
      icon: WifiOff,
      color: offlineCount > 0 ? 'text-red-400' : 'text-slate-500',
      bg:    offlineCount > 0 ? 'bg-red-400/10' : 'bg-slate-700/30',
    },
    {
      label: 'Critical / High',
      value: String(criticalCount),
      icon: ShieldCheck,
      color: criticalCount > 0 ? 'text-orange-400' : 'text-slate-500',
      bg:    criticalCount > 0 ? 'bg-orange-400/10' : 'bg-slate-700/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
      {tiles.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card px-4 py-3 flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-white tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main dashboard client ────────────────────────────────────────────────────
export default function SuperAdminDashboardClient() {
  const { socket, status } = useSocket();
  const addAlert            = useAlertsStore((s) => s.addAlert);
  const updateCenterStatus  = useAlertsStore((s) => s.updateCenterStatus);
  const addOfflineDevice    = useAlertsStore((s) => s.addOfflineDevice);
  const dismissOfflineDevice = useAlertsStore((s) => s.dismissOfflineDevice);
  const offlineDevices      = useAlertsStore((s) => s.offlineDevices);

  const visibleOffline = offlineDevices.filter((d) => !d.dismissed);

  /**
   * Subscribe to all WS events.
   * Re-runs only when the socket instance changes (i.e. on login/logout).
   * Each alert event → addAlert()
   * device_status event → updateCenterStatus() + addAlert() if device goes OFFLINE
   * alert:device_offline → addOfflineDevice() (Red Alert banner)
   */
  useEffect(() => {
    if (!socket) return;

    // ── Alert events ──────────────────────────────────────────────────────────
    const handlers: Array<{ event: string; fn: (data: unknown) => void }> = [];

    for (const event of ALERT_EVENTS) {
      const fn = (data: unknown) => {
        addAlert(event, data as WsEventEnvelope);
      };
      socket.on(event, fn);
      handlers.push({ event, fn });
    }

    // ── alert:device_offline → red alert banner ──────────────────────────────
    const offlineFn = (data: unknown) => {
      addOfflineDevice(data as WsEventEnvelope);
    };
    socket.on('alert:device_offline', offlineFn);

    // ── device_status → update center map + optional alert ───────────────────
    const deviceStatusFn = (data: unknown) => {
      const envelope = data as WsEventEnvelope;
      updateCenterStatus(envelope);

      // Surface offline events in the alert feed with MEDIUM severity
      const rawData = (envelope.data ?? {}) as Record<string, unknown>;
      if (rawData['status'] === 'OFFLINE' || rawData['status'] === 'MAINTENANCE') {
        addAlert('update:device_status', {
          ...envelope,
          severity: rawData['status'] === 'OFFLINE' ? 'MEDIUM' : 'LOW',
        } as WsEventEnvelope);
      }
    };
    socket.on('update:device_status', deviceStatusFn);

    // ── system:connected — logged for debugging ───────────────────────────────
    const connectedFn = (data: unknown) => {
      console.info('[Socket] system:connected', data);
    };
    socket.on('system:connected', connectedFn);

    return () => {
      handlers.forEach(({ event, fn }) => socket.off(event, fn));
      socket.off('alert:device_offline', offlineFn);
      socket.off('update:device_status', deviceStatusFn);
      socket.off('system:connected', connectedFn);
    };
  }, [socket, addAlert, updateCenterStatus, addOfflineDevice]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time AI surveillance across all{' '}
            <span className="text-cyan-400 font-semibold">105</span> Falcon Security centers
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {/* ── Offline device red alert banners ────────────────────────────── */}
      {visibleOffline.length > 0 && (
        <div className="flex flex-col gap-2 shrink-0">
          {visibleOffline.slice(0, 5).map((device) => (
            <OfflineDeviceBanner
              key={device.key}
              device={device}
              onDismiss={() => dismissOfflineDevice(device.key)}
            />
          ))}
          {visibleOffline.length > 5 && (
            <p className="text-xs text-red-400 text-center">
              +{visibleOffline.length - 5} more devices offline
            </p>
          )}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <KpiStrip />

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left: Center Status Grid — takes all remaining horizontal space */}
        <div className="flex-1 min-w-0 overflow-y-auto pb-2">
          <CenterStatusGrid />
        </div>

        {/* Right: Live Alerts Feed — fixed 320 px column */}
        <div className="w-80 shrink-0 flex flex-col min-h-0">
          <LiveAlertsFeed />
        </div>
      </div>
    </div>
  );
}
