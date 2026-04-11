'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Cpu,
  Plus,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Radio,
} from 'lucide-react';
import { camerasApi, espNodesApi } from '@/lib/api';
import type { Camera as CameraType, EspNode, DeviceStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import type { WsEventEnvelope } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PingState {
  pinging: boolean;
  latencyMs: number | null;
  lastPingedAt: string | null;
}

interface CameraRow extends CameraType {
  pingState: PingState;
}

interface EspRow extends EspNode {
  pingState: PingState;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status, pinging }: { status: DeviceStatus | string; pinging: boolean }) {
  if (pinging) {
    return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
  }
  const s = status as DeviceStatus;
  const map: Record<string, string> = {
    ONLINE: 'bg-emerald-500',
    OFFLINE: 'bg-red-500',
    MAINTENANCE: 'bg-amber-400',
    UNKNOWN: 'bg-slate-400',
  };
  return (
    <span className={cn('inline-block w-2.5 h-2.5 rounded-full', map[s] ?? 'bg-slate-400')} />
  );
}

function StatusBadge({ status, latencyMs, pinging }: { status: DeviceStatus | string; latencyMs: number | null; pinging: boolean }) {
  if (pinging) {
    return <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Pinging…</span>;
  }
  const labels: Record<string, string> = {
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    MAINTENANCE: 'Maintenance',
    UNKNOWN: 'Unknown',
  };
  const colors: Record<string, string> = {
    ONLINE: 'text-emerald-400',
    OFFLINE: 'text-red-400',
    MAINTENANCE: 'text-amber-400',
    UNKNOWN: 'text-slate-400',
  };
  return (
    <span className={cn('text-xs font-medium flex items-center gap-1', colors[status] ?? 'text-slate-400')}>
      <StatusDot status={status} pinging={false} />
      {labels[status as string] ?? status}
      {status === 'ONLINE' && latencyMs !== null && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 text-[10px]">
          {latencyMs}ms
        </span>
      )}
    </span>
  );
}

// ─── Camera Form ─────────────────────────────────────────────────────────────

interface CameraFormData {
  name: string;
  rtspUrl: string;
  ipAddress: string;
  model: string;
}

const emptyCameraForm: CameraFormData = { name: '', rtspUrl: '', ipAddress: '', model: '' };

function AddCameraForm({
  centerId,
  onAdded,
}: {
  centerId: string;
  onAdded: (cam: CameraType) => void;
}) {
  const [form, setForm] = useState<CameraFormData>(emptyCameraForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof CameraFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Camera name is required'); return; }
    if (!form.rtspUrl.trim()) { setError('RTSP URL is required'); return; }
    if (!form.ipAddress.trim()) { setError('IP address is required'); return; }
    setSubmitting(true);
    try {
      const res = await camerasApi.create({
        name: form.name.trim(),
        rtspUrl: form.rtspUrl.trim(),
        ipAddress: form.ipAddress.trim(),
        model: form.model.trim() || undefined,
        centerId,
      });
      setForm(emptyCameraForm);
      onAdded(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to add camera'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Camera Name <span className="text-red-400">*</span></label>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Entrance Cam"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Model <span className="text-slate-500">(optional)</span></label>
          <input
            value={form.model}
            onChange={set('model')}
            placeholder="e.g. Hikvision DS-2CD"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">IP Address <span className="text-red-400">*</span></label>
          <input
            value={form.ipAddress}
            onChange={set('ipAddress')}
            placeholder="192.168.1.100"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">RTSP URL <span className="text-red-400">*</span></label>
          <input
            value={form.rtspUrl}
            onChange={set('rtspUrl')}
            placeholder="rtsp://user:pass@192.168.1.100:554/stream"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Camera
        </button>
      </div>
    </form>
  );
}

// ─── ESP Form ─────────────────────────────────────────────────────────────────

interface EspFormData {
  name: string;
  macAddress: string;
  ipAddress: string;
  firmwareVer: string;
}

const emptyEspForm: EspFormData = { name: '', macAddress: '', ipAddress: '', firmwareVer: '' };

function AddEspForm({
  centerId,
  onAdded,
}: {
  centerId: string;
  onAdded: (node: EspNode) => void;
}) {
  const [form, setForm] = useState<EspFormData>(emptyEspForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof EspFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Node name is required'); return; }
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(form.macAddress.trim())) {
      setError('Invalid MAC address — expected format AA:BB:CC:DD:EE:FF');
      return;
    }
    if (!form.ipAddress.trim()) { setError('IP address is required'); return; }
    setSubmitting(true);
    try {
      const res = await espNodesApi.create({
        name: form.name.trim(),
        macAddress: form.macAddress.trim().toUpperCase(),
        ipAddress: form.ipAddress.trim(),
        firmwareVer: form.firmwareVer.trim() || undefined,
        centerId,
      });
      setForm(emptyEspForm);
      onAdded(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to add ESP node'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Node Name <span className="text-red-400">*</span></label>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Table-A Node"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">MAC Address <span className="text-red-400">*</span></label>
          <input
            value={form.macAddress}
            onChange={set('macAddress')}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">IP Address <span className="text-red-400">*</span></label>
          <input
            value={form.ipAddress}
            onChange={set('ipAddress')}
            placeholder="192.168.1.200"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Firmware Version <span className="text-slate-500">(optional)</span></label>
          <input
            value={form.firmwareVer}
            onChange={set('firmwareVer')}
            placeholder="v1.0.0"
            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add ESP Node
        </button>
      </div>
    </form>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  count,
  children,
  addForm,
  addFormLabel,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
  addForm: React.ReactNode;
  addFormLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-slate-100">
          {icon}
          <span className="font-semibold text-base">{title}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs font-medium">
            {count}
          </span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-sm font-medium transition"
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {open ? 'Cancel' : addFormLabel}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Add Form */}
      {open && (
        <div className="px-5 py-4 bg-slate-900/40 border-b border-slate-700/40">
          {addForm}
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-slate-700/40">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeviceManagerTab({ centerId }: { centerId: string }) {
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [espNodes, setEspNodes] = useState<EspRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { on, isConnected } = useSocket();

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [camRes, espRes] = await Promise.all([
        camerasApi.getAll({ centerId }),
        espNodesApi.getAll({ centerId }),
      ]);
      setCameras(
        camRes.data.map((c) => ({ ...c, pingState: { pinging: false, latencyMs: null, lastPingedAt: null } }))
      );
      setEspNodes(
        espRes.data.map((e) => ({ ...e, pingState: { pinging: false, latencyMs: null, lastPingedAt: null } }))
      );
    } catch {
      setLoadError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── Real-time WebSocket: update:device_status ──────────────────────────
  // Listens for status changes pushed by the backend (camera poller + MQTT)
  // and updates the local state without a full re-fetch.
  useEffect(() => {
    const unsub = on<WsEventEnvelope>('update:device_status', (envelope) => {
      // Only handle events for THIS center
      if (envelope.centerId !== centerId) return;
      const raw = (envelope.data ?? {}) as Record<string, unknown>;
      const deviceId   = raw['deviceId']   as string | undefined;
      const deviceType = raw['deviceType'] as string | undefined;
      const status     = raw['status']     as DeviceStatus | undefined;
      const latencyMs  = raw['latencyMs']  as number | null | undefined;
      if (!deviceId || !status) return;

      if (deviceType === 'CAMERA') {
        setCameras((prev) =>
          prev.map((c) =>
            c.id === deviceId
              ? {
                  ...c,
                  status,
                  pingState: {
                    pinging: false,
                    latencyMs: latencyMs ?? c.pingState.latencyMs,
                    lastPingedAt: envelope.serverTime,
                  },
                }
              : c
          )
        );
      } else if (deviceType === 'ESP_NODE') {
        setEspNodes((prev) =>
          prev.map((e) =>
            e.id === deviceId
              ? {
                  ...e,
                  status,
                  lastSeenAt: envelope.serverTime,
                  pingState: {
                    pinging: false,
                    latencyMs: latencyMs ?? e.pingState.latencyMs,
                    lastPingedAt: envelope.serverTime,
                  },
                }
              : e
          )
        );
      }
    });
    return unsub;
  }, [centerId, on]);

  // ── Camera ping ────────────────────────────────────────────────────────
  const pingCamera = useCallback(async (id: string) => {
    setCameras((prev) =>
      prev.map((c) => c.id === id ? { ...c, pingState: { ...c.pingState, pinging: true } } : c)
    );
    try {
      const res = await camerasApi.ping(id);
      const { status, latencyMs } = res.data;
      setCameras((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: status as DeviceStatus,
                pingState: { pinging: false, latencyMs, lastPingedAt: new Date().toISOString() },
              }
            : c
        )
      );
    } catch {
      setCameras((prev) =>
        prev.map((c) => c.id === id ? { ...c, pingState: { pinging: false, latencyMs: null, lastPingedAt: new Date().toISOString() } } : c)
      );
    }
  }, []);

  // ── ESP ping ───────────────────────────────────────────────────────────
  const pingEsp = useCallback(async (id: string) => {
    setEspNodes((prev) =>
      prev.map((e) => e.id === id ? { ...e, pingState: { ...e.pingState, pinging: true } } : e)
    );
    try {
      const res = await espNodesApi.ping(id);
      const { status, latencyMs } = res.data;
      setEspNodes((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status: status as DeviceStatus,
                pingState: { pinging: false, latencyMs, lastPingedAt: new Date().toISOString() },
              }
            : e
        )
      );
    } catch {
      setEspNodes((prev) =>
        prev.map((e) => e.id === id ? { ...e, pingState: { pinging: false, latencyMs: null, lastPingedAt: new Date().toISOString() } } : e)
      );
    }
  }, []);

  // ── After add camera: auto-ping ────────────────────────────────────────
  const handleCameraAdded = useCallback(
    (cam: CameraType) => {
      const row: CameraRow = { ...cam, pingState: { pinging: false, latencyMs: null, lastPingedAt: null } };
      setCameras((prev) => [...prev, row]);
      // Auto-ping if IP is present
      if (cam.ipAddress) {
        setTimeout(() => pingCamera(cam.id), 300);
      }
    },
    [pingCamera]
  );

  // ── After add ESP: auto-ping ───────────────────────────────────────────
  const handleEspAdded = useCallback(
    (node: EspNode) => {
      const row: EspRow = { ...node, pingState: { pinging: false, latencyMs: null, lastPingedAt: null } };
      setEspNodes((prev) => [...prev, row]);
      if (node.ipAddress) {
        setTimeout(() => pingEsp(node.id), 300);
      }
    },
    [pingEsp]
  );

  // ── Remove camera ──────────────────────────────────────────────────────
  const removeCamera = useCallback(async (id: string) => {
    if (!confirm('Remove this camera?')) return;
    try {
      await camerasApi.remove(id);
      setCameras((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to remove camera');
    }
  }, []);

  // ── Remove ESP ─────────────────────────────────────────────────────────
  const removeEsp = useCallback(async (id: string) => {
    if (!confirm('Remove this ESP node?')) return;
    try {
      await espNodesApi.remove(id);
      setEspNodes((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert('Failed to remove ESP node');
    }
  }, []);

  // ── Ping all ───────────────────────────────────────────────────────────
  const pingAll = useCallback(async () => {
    const camIds = cameras.filter((c) => c.ipAddress).map((c) => c.id);
    const espIds = espNodes.filter((e) => e.ipAddress).map((e) => e.id);
    await Promise.all([...camIds.map(pingCamera), ...espIds.map(pingEsp)]);
  }, [cameras, espNodes, pingCamera, pingEsp]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading devices…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-400 gap-3">
        <AlertTriangle className="w-8 h-8" />
        <p>{loadError}</p>
        <button onClick={fetchDevices} className="text-sm underline text-slate-300 hover:text-white">
          Retry
        </button>
      </div>
    );
  }

  const anyPinging = cameras.some((c) => c.pingState.pinging) || espNodes.some((e) => e.pingState.pinging);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            Device Manager
            {isConnected && (
              <span className="flex items-center gap-1 text-xs font-normal text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                <Radio className="w-3 h-3 animate-pulse" />
                Live
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage cameras and ESP32 nodes for this center
          </p>
        </div>
        <button
          onClick={pingAll}
          disabled={anyPinging}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm font-medium transition"
        >
          {anyPinging ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Ping All
        </button>
      </div>

      {/* ── Cameras ──────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Camera className="w-5 h-5 text-indigo-400" />}
        title="Cameras"
        count={cameras.length}
        addFormLabel="Add Camera"
        addForm={
          <AddCameraForm centerId={centerId} onAdded={handleCameraAdded} />
        }
      >
        {cameras.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            No cameras registered. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide bg-slate-900/30">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">RTSP URL</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((cam) => (
                  <tr
                    key={cam.id}
                    className="border-t border-slate-700/40 hover:bg-slate-700/20 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{cam.name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {cam.ipAddress ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px]">
                      <span
                        className="block truncate font-mono text-xs"
                        title={cam.rtspUrl}
                      >
                        {cam.rtspUrl}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {cam.model ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={cam.status}
                        latencyMs={cam.pingState.latencyMs}
                        pinging={cam.pingState.pinging}
                      />
                      {cam.pingState.lastPingedAt && !cam.pingState.pinging && (
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {new Date(cam.pingState.lastPingedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => pingCamera(cam.id)}
                          disabled={cam.pingState.pinging || !cam.ipAddress}
                          title={cam.ipAddress ? 'Ping device' : 'No IP address'}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-indigo-700 disabled:opacity-40 text-slate-300 transition"
                        >
                          {cam.pingState.pinging ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : cam.status === 'ONLINE' ? (
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => removeCamera(cam.id)}
                          title="Remove camera"
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── ESP Nodes ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Cpu className="w-5 h-5 text-cyan-400" />}
        title="ESP32 Nodes"
        count={espNodes.length}
        addFormLabel="Add ESP Node"
        addForm={
          <AddEspForm centerId={centerId} onAdded={handleEspAdded} />
        }
      >
        {espNodes.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            No ESP32 nodes registered. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide bg-slate-900/30">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">MAC Address</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Firmware</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last Seen</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {espNodes.map((node) => (
                  <tr
                    key={node.id}
                    className="border-t border-slate-700/40 hover:bg-slate-700/20 transition"
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{node.name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{node.macAddress}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {node.ipAddress ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {node.firmwareVer ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={node.status}
                        latencyMs={node.pingState.latencyMs}
                        pinging={node.pingState.pinging}
                      />
                      {node.pingState.lastPingedAt && !node.pingState.pinging && (
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {new Date(node.pingState.lastPingedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {node.lastSeenAt
                        ? new Date(node.lastSeenAt).toLocaleString()
                        : <span className="text-slate-600">Never</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => pingEsp(node.id)}
                          disabled={node.pingState.pinging || !node.ipAddress}
                          title={node.ipAddress ? 'Ping device' : 'No IP address'}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-cyan-800 disabled:opacity-40 text-slate-300 transition"
                        >
                          {node.pingState.pinging ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : node.status === 'ONLINE' ? (
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => removeEsp(node.id)}
                          title="Remove node"
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
