'use client';

/**
 * SuperAdminDashboardClient  — Enterprise Edition
 * ─────────────────────────────────────────────────
 * Five-panel layout:
 *
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  Top KPI strip  (4 tiles: centers · devices · alerts · GPU mode)        │
 *  ├──────────────────────────────────┬──────────────────────────────────────┤
 *  │  LEFT (flex-1)                   │  RIGHT (320px fixed)                  │
 *  │  ┌───────────────────────────┐   │  ConfidencedAlertsTicker              │
 *  │  │ ResourceSaverPanel        │   │  (live feed with confidence +         │
 *  │  └───────────────────────────┘   │   source tech)                        │
 *  │  ┌───────────────────────────┐   │                                       │
 *  │  │ UnifiedStatusMatrix       │   │                                       │
 *  │  │ (20 objectives, full      │   │                                       │
 *  │  │  height scrollable)       │   │                                       │
 *  │  └───────────────────────────┘   │                                       │
 *  └──────────────────────────────────┴──────────────────────────────────────┘
 *
 * All WS subscriptions handled here — routed to the Zustand store.
 * New events: weapon_detected, fire_detected, sick_detected, idle_agent,
 *   long_service, long_stay, vandalism_detected, irate_customer,
 *   challenged_visitor, ghost_token, repeated_visit,
 *   update:objective_status, update:resource_saver, update:hybrid_source.
 */

import { useEffect } from 'react';
import { Wifi, WifiOff, Loader2, Building2, ShieldCheck, XCircle, AlertTriangle, Cpu, ZapOff } from 'lucide-react';

import { useSocket } from '@/hooks/useSocket';
import {
  useAlertsStore,
  ALERT_EVENTS,
  type OfflineDeviceAlert,
} from '@/store/alerts.store';
import type { ConfidencedAlert, WsEventEnvelope } from '@/types';
import { OBJECTIVES } from '@/components/dashboard/UnifiedStatusMatrix';
import { cn } from '@/lib/utils';

import UnifiedStatusMatrix       from '@/components/dashboard/UnifiedStatusMatrix';
import ResourceSaverPanel        from '@/components/dashboard/ResourceSaverPanel';
import ConfidencedAlertsTicker   from '@/components/dashboard/ConfidencedAlertsTicker';
import CenterHealthSidebar       from '@/components/dashboard/CenterHealthSidebar';

// ─── Helper: map WS event → objective IDs ────────────────────────────────────
function wsEventToObjectiveIds(event: string): number[] {
  return OBJECTIVES.filter((o) => o.wsEvents.includes(event)).map((o) => o.id);
}

// ─── Helper: infer source tech ────────────────────────────────────────────────
function inferTech(event: string, data: Record<string, unknown>): string {
  if (typeof data['tech'] === 'string') return data['tech'];
  if (event.includes('audio') || event === 'alert:vandalism_detected') return 'AUDIO';
  if (event === 'update:wifi_sensing' || event.includes('wifi'))        return 'WIFI';
  return 'CCTV';
}

// ─── Offline device banner ─────────────────────────────────────────────────────
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
      <button onClick={onDismiss} className="shrink-0 p-0.5 rounded hover:bg-red-800/60 transition" title="Dismiss">
        <XCircle className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

// ─── Connection badge ─────────────────────────────────────────────────────────
function ConnectionBadge({ status }: { status: string }) {
  const isConnected = status === 'connected';
  const isTransient = status === 'connecting' || status === 'reconnecting';
  const isError     = status === 'error' || status === 'disconnected';
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border select-none',
      isConnected ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : '',
      isTransient ? 'text-amber-400  bg-amber-400/10  border-amber-400/20'  : '',
      isError     ? 'text-red-400    bg-red-400/10    border-red-400/20'    : '',
      status === 'idle' ? 'text-slate-500 bg-slate-500/10 border-slate-700' : '',
    )}>
      {isConnected && (<><Wifi className="w-3.5 h-3.5" /><span>Live</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /></>)}
      {isTransient && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="capitalize">{status}…</span></>)}
      {(isError || status === 'idle') && (<><WifiOff className="w-3.5 h-3.5" /><span className="capitalize">{status === 'idle' ? 'Disconnected' : status}</span></>)}
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KpiStrip() {
  const centerStatus        = useAlertsStore((s) => s.centerStatus);
  const objectiveStatuses   = useAlertsStore((s) => s.objectiveStatuses);
  const resourceSaverGlobal = useAlertsStore((s) => s.resourceSaverGlobal);

  const onlineCount  = Object.values(centerStatus).filter((s) => s.status === 'ONLINE').length;
  const activeAlerts = Object.values(objectiveStatuses).filter((s) => s.status === 'ALERT').length;

  const tiles = [
    { label: 'Total Centers',  value: '105',               icon: Building2,  color: 'text-cyan-400',    bg: 'bg-cyan-400/10'    },
    { label: 'Devices Online', value: String(onlineCount), icon: Wifi,       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Active Alerts',  value: String(activeAlerts),icon: ShieldCheck,
      color: activeAlerts > 0 ? 'text-red-400'    : 'text-slate-500',
      bg:    activeAlerts > 0 ? 'bg-red-400/10'   : 'bg-slate-700/30' },
    {
      label: 'GPU Mode',
      value: resourceSaverGlobal ? 'SAVER' : 'FULL',
      icon:  resourceSaverGlobal ? ZapOff : Cpu,
      color: resourceSaverGlobal ? 'text-cyan-400'   : 'text-purple-400',
      bg:    resourceSaverGlobal ? 'bg-cyan-400/10'  : 'bg-purple-400/10',
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

  const addAlert              = useAlertsStore((s) => s.addAlert);
  const updateCenterStatus    = useAlertsStore((s) => s.updateCenterStatus);
  const addOfflineDevice      = useAlertsStore((s) => s.addOfflineDevice);
  const dismissOfflineDevice  = useAlertsStore((s) => s.dismissOfflineDevice);
  const offlineDevices        = useAlertsStore((s) => s.offlineDevices);
  const updateObjectiveStatus = useAlertsStore((s) => s.updateObjectiveStatus);
  const setResourceSaver      = useAlertsStore((s) => s.setResourceSaver);
  const setHybridSource       = useAlertsStore((s) => s.setHybridSource);
  const addConfidencedAlert   = useAlertsStore((s) => s.addConfidencedAlert);

  const visibleOffline = offlineDevices.filter((d) => !d.dismissed);

  useEffect(() => {
    if (!socket) return;

    const handlers: Array<{ event: string; fn: (data: unknown) => void }> = [];

    // ── All alert events → feed + objective status update ─────────────────
    for (const event of ALERT_EVENTS) {
      const fn = (data: unknown) => {
        const envelope = data as WsEventEnvelope;
        addAlert(event, envelope);

        const rawData    = (envelope.data ?? {}) as Record<string, unknown>;
        const tech       = inferTech(event, rawData);
        const confidence = typeof rawData['confidence'] === 'number' ? rawData['confidence'] : 0;
        const objIds     = wsEventToObjectiveIds(event);

        // Update objective status rows in the matrix
        for (const objectiveId of objIds) {
          updateObjectiveStatus({
            ...envelope,
            data: {
              objectiveId,
              status:     'ALERT',
              confidence: +(confidence * 100).toFixed(1),
              tech,
            },
          });
        }

        // Add to confidenced feed ticker
        const objDef = OBJECTIVES.find((o) => objIds.includes(o.id));
        const caAlert: ConfidencedAlert = {
          id:             `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          objectiveId:    objIds[0] ?? 0,
          objectiveLabel: objDef?.label ?? event.replace('alert:', '').replaceAll('_', ' '),
          tech:           tech as ConfidencedAlert['tech'],
          confidence:     +(confidence * 100).toFixed(1),
          centerId:       envelope.centerId,
          centerName:     envelope.centerName,
          severity:       envelope.severity,
          serverTime:     envelope.serverTime,
          data:           rawData,
        };
        addConfidencedAlert(caAlert);
      };
      socket.on(event, fn);
      handlers.push({ event, fn });
    }

    // ── alert:device_offline → red banner ───────────────────────────────────
    const offlineFn = (data: unknown) => { addOfflineDevice(data as WsEventEnvelope); };
    socket.on('alert:device_offline', offlineFn);

    // ── update:device_status ─────────────────────────────────────────────────
    const deviceStatusFn = (data: unknown) => {
      const envelope = data as WsEventEnvelope;
      updateCenterStatus(envelope);
      const rawData = (envelope.data ?? {}) as Record<string, unknown>;
      if (rawData['status'] === 'OFFLINE' || rawData['status'] === 'MAINTENANCE') {
        addAlert('update:device_status', {
          ...envelope,
          severity: rawData['status'] === 'OFFLINE' ? 'MEDIUM' : 'LOW',
        } as WsEventEnvelope);
      }
    };
    socket.on('update:device_status', deviceStatusFn);

    // ── update:objective_status (pushed directly from backend) ───────────────
    const objStatusFn = (data: unknown) => { updateObjectiveStatus(data as WsEventEnvelope); };
    socket.on('update:objective_status', objStatusFn);

    // ── update:resource_saver ─────────────────────────────────────────────────
    const resourceSaverFn = (data: unknown) => {
      const d = ((data as WsEventEnvelope).data ?? {}) as Record<string, unknown>;
      const centerId = d['centerId'] === 'global' ? undefined : d['centerId'] as string | undefined;
      setResourceSaver(Boolean(d['enabled']), centerId);
    };
    socket.on('update:resource_saver', resourceSaverFn);

    // ── update:hybrid_source ──────────────────────────────────────────────────
    const hybridSourceFn = (data: unknown) => {
      const d = ((data as WsEventEnvelope).data ?? {}) as Record<string, unknown>;
      setHybridSource({
        objectiveId:      d['objectiveId'] as number,
        preferLowCompute: Boolean(d['preferLowCompute']),
        primarySource:    (d['primarySource'] as ConfidencedAlert['tech']) ?? 'CCTV',
      });
    };
    socket.on('update:hybrid_source', hybridSourceFn);

    // ── system:connected ──────────────────────────────────────────────────────
    const connectedFn = (data: unknown) => { console.info('[Socket] system:connected', data); };
    socket.on('system:connected', connectedFn);

    return () => {
      handlers.forEach(({ event, fn }) => socket.off(event, fn));
      socket.off('alert:device_offline', offlineFn);
      socket.off('update:device_status', deviceStatusFn);
      socket.off('update:objective_status', objStatusFn);
      socket.off('update:resource_saver', resourceSaverFn);
      socket.off('update:hybrid_source', hybridSourceFn);
      socket.off('system:connected', connectedFn);
    };
  }, [socket, addAlert, updateCenterStatus, addOfflineDevice, updateObjectiveStatus,
      setResourceSaver, setHybridSource, addConfidencedAlert]);

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time AI surveillance ·{' '}
            <span className="text-cyan-400 font-semibold">105</span> centers ·{' '}
            <span className="text-purple-400 font-semibold">20</span> objectives ·{' '}
            <span className="text-amber-400 font-semibold">3</span> sensor sources
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {/* ── Offline device red alert banners ────────────────────────────── */}
      {visibleOffline.length > 0 && (
        <div className="flex flex-col gap-2 shrink-0">
          {visibleOffline.slice(0, 3).map((device) => (
            <OfflineDeviceBanner
              key={device.key}
              device={device}
              onDismiss={() => dismissOfflineDevice(device.key)}
            />
          ))}
          {visibleOffline.length > 3 && (
            <p className="text-xs text-red-400 text-center">
              +{visibleOffline.length - 3} more devices offline
            </p>
          )}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <KpiStrip />

      {/* ── Main 2-column layout ────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Left column — GPU panel + 20-objective matrix */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pb-2">
          <ResourceSaverPanel className="shrink-0" />
          <UnifiedStatusMatrix className="flex-1 min-h-[400px]" />
        </div>

        {/* Centre column — live intelligence ticker */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          <ConfidencedAlertsTicker className="flex-1" />
        </div>

        {/* Right column — device connectivity health sidebar */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          <CenterHealthSidebar className="flex-1" />
        </div>

      </div>
    </div>
  );
}

