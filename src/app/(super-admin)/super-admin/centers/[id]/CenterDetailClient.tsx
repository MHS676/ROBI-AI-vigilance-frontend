'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Phone,
  Camera,
  Cpu,
  Mic,
  Table2,
  Users,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Pencil,
  PowerOff,
  Loader2,
  X,
} from 'lucide-react';
import { centersApi, usersApi } from '@/lib/api';
import { useAlertsStore } from '@/store/alerts.store';
import type { Center, HardwareInventory, User, DeviceStatus } from '@/types';
import { cn } from '@/lib/utils';
import DeviceManagerTab from './DeviceManagerTab';
import SetupWizard from './SetupWizard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusMeta: Record<
  DeviceStatus,
  { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ONLINE:      { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: Wifi },
  OFFLINE:     { color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',         icon: WifiOff },
  MAINTENANCE: { color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20',     icon: AlertTriangle },
};

function StatusBadge({ status }: { status: DeviceStatus }) {
  const { color, bg, icon: Icon } = statusMeta[status] ?? statusMeta.OFFLINE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        color,
        bg,
      )}
    >
      <Icon className="w-3 h-3" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'hardware' | 'staff' | 'devices';

// ─── Edit Center Modal ────────────────────────────────────────────────────────
interface EditForm {
  name: string; code: string; address: string;
  city: string; state: string; country: string; phone: string;
}

function EditCenterModal({
  center,
  onSaved,
  onClose,
}: {
  center: Center;
  onSaved: (c: Center) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    name:    center.name    ?? '',
    code:    center.code    ?? '',
    address: center.address ?? '',
    city:    center.city    ?? '',
    state:   center.state   ?? '',
    country: center.country ?? '',
    phone:   center.phone   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Center name is required'); return; }
    setSaving(true); setError(null);
    try {
      const { data } = await centersApi.update(center.id, {
        name:    form.name.trim(),
        code:    form.code.trim(),
        address: form.address.trim() || undefined,
        city:    form.city.trim()    || undefined,
        state:   form.state.trim()   || undefined,
        country: form.country.trim() || undefined,
        phone:   form.phone.trim()   || undefined,
      });
      onSaved(data);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(' · ') : String(raw ?? 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  // Dismiss on overlay click
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-cyan-400" />
            <p className="text-sm font-semibold text-white">Edit Center</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {[
            { k: 'name'    as keyof EditForm, label: 'Center Name *',   placeholder: 'Falcon Branch — Abuja' },
            { k: 'code'    as keyof EditForm, label: 'Branch Code *',   placeholder: 'FAL-ABJ-002' },
            { k: 'address' as keyof EditForm, label: 'Street Address',  placeholder: '14 Broad Street' },
            { k: 'city'    as keyof EditForm, label: 'City',            placeholder: 'Lagos Island' },
            { k: 'state'   as keyof EditForm, label: 'State',           placeholder: 'Lagos' },
            { k: 'country' as keyof EditForm, label: 'Country',         placeholder: 'Nigeria' },
            { k: 'phone'   as keyof EditForm, label: 'Phone',           placeholder: '+234-800-FALCON-1' },
          ].map(({ k, label, placeholder }) => (
            <div key={k}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                value={form[k]}
                onChange={set(k)}
                placeholder={placeholder}
                className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-slate-900 font-semibold text-sm rounded-xl transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-64 bg-slate-800 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/50" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-800/30" />
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <div className="card px-4 py-3 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-white tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

// ─── Hardware card ────────────────────────────────────────────────────────────
function HardwareCard({
  name,
  detail,
  status,
  assigned,
}: {
  name: string;
  detail: string;
  status: DeviceStatus;
  assigned?: string | null;
}) {
  return (
    <div className="card px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-white leading-tight truncate">{name}</p>
        <StatusBadge status={status} />
      </div>
      <p className="text-[10px] text-slate-500 font-mono truncate">{detail}</p>
      {assigned ? (
        <p className="text-[10px] text-cyan-400 truncate">
          ↳ Table: {assigned}
        </p>
      ) : (
        <p className="text-[10px] text-slate-700">Unassigned</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CenterDetailClient({
  centerId,
  setupMode = false,
}: {
  centerId: string;
  setupMode?: boolean;
}) {
  const router = useRouter();
  const [center,       setCenter]       = useState<Center | null>(null);
  const [hardware,     setHardware]     = useState<HardwareInventory | null>(null);
  const [staff,        setStaff]        = useState<User[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<Tab>(setupMode ? 'devices' : 'overview');
  const [showEdit,     setShowEdit]     = useState(false);
  const [showWizard,   setShowWizard]   = useState(setupMode);
  const [deactivating, setDeactivating] = useState(false);

  const liveStatus = useAlertsStore((s) => s.centerStatus[centerId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [centerRes, hwRes, staffRes] = await Promise.all([
        centersApi.getOne(centerId),
        centersApi.getHardware(centerId),
        usersApi.getAll({ centerId }),
      ]);
      setCenter(centerRes.data);
      setHardware(hwRes.data);
      setStaff(staffRes.data);
    } catch {
      setError('Failed to load center data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Deactivate center ──────────────────────────────────────────────────
  const handleDeactivate = useCallback(async () => {
    if (!center) return;
    if (!confirm(`Deactivate "${center.name}"? The center will be hidden from active lists.`)) return;
    setDeactivating(true);
    try {
      await centersApi.remove(center.id);
      router.push('/super-admin/centers');
    } catch {
      alert('Failed to deactivate center');
      setDeactivating(false);
    }
  }, [center, router]);

  // ── Derived counts ──────────────────────────────────────────────────────
  const counts = center?._count;
  const liveOnline  = liveStatus?.status === 'ONLINE';
  const liveOffline = liveStatus?.status === 'OFFLINE';

  if (loading) return <Skeleton />;

  if (error || !center) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Building2 className="w-10 h-10 text-slate-600" />
        <p className="text-sm text-red-400">{error ?? 'Center not found'}</p>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:underline"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: 'Overview'  },
    { key: 'hardware', label: `Hardware (${(hardware?.cameras.length ?? 0) + (hardware?.espNodes.length ?? 0) + (hardware?.microphones.length ?? 0)})` },
    { key: 'staff',    label: `Staff (${staff.length})` },
    { key: 'devices',  label: 'Device Manager' },
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* ── Back breadcrumb ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
        <Link href="/super-admin/dashboard" className="hover:text-slate-300 transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-300">{center.name}</span>
      </div>

      {/* ── Center header ────────────────────────────────────────────────── */}
      <div className="card px-5 py-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white">{center.name}</h1>
                <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  {center.code}
                </span>
                {center.isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-700/50 border border-slate-700 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[center.address, center.city, center.state].filter(Boolean).join(', ')}
                </span>
                {center.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {center.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live status + actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {liveStatus && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                  liveOnline  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : '',
                  liveOffline ? 'text-red-400 bg-red-400/10 border-red-400/20'             : '',
                  !liveOnline && !liveOffline ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : '',
                )}
              >
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  liveOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400',
                )} />
                Live · {liveStatus.status?.toLowerCase()}
              </span>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={handleDeactivate}
              disabled={deactivating || !center.isActive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-slate-800 border border-red-900/40 rounded-lg transition disabled:opacity-40"
            >
              {deactivating
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <PowerOff className="w-3 h-3" />
              }
              {center.isActive ? 'Deactivate' : 'Inactive'}
            </button>
            <button
              onClick={fetchAll}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 shrink-0">
        <KpiTile label="Cameras"     value={counts?.cameras      ?? hardware?.cameras.length      ?? 0} icon={Camera} color="text-cyan-400"    bg="bg-cyan-400/10" />
        <KpiTile label="ESP Nodes"   value={counts?.espNodes     ?? hardware?.espNodes.length     ?? 0} icon={Cpu}    color="text-violet-400" bg="bg-violet-400/10" />
        <KpiTile label="Microphones" value={counts?.microphones  ?? hardware?.microphones.length  ?? 0} icon={Mic}    color="text-pink-400"   bg="bg-pink-400/10" />
        <KpiTile label="Tables"      value={counts?.tables       ?? 0}                                   icon={Table2} color="text-amber-400"  bg="bg-amber-400/10" />
        <KpiTile label="Staff"       value={counts?.users        ?? staff.length}                        icon={Users}  color="text-slate-300"  bg="bg-slate-700/50" />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-800 shrink-0">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              activeTab === key
                ? 'text-cyan-400 border-cyan-400'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Center info */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Center Information</h3>
            {[
              { label: 'Code',     value: center.code },
              { label: 'Address',  value: center.address },
              { label: 'City',     value: center.city },
              { label: 'State',    value: center.state },
              { label: 'Country',  value: center.country },
              { label: 'Phone',    value: center.phone },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-slate-500 shrink-0">{label}</span>
                <span className="text-slate-200 text-right">{value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Hardware at-a-glance */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Hardware Status</h3>
            {hardware && (
              <>
                {[
                  { label: 'Cameras Online',   value: hardware.cameras.filter((c) => c.status === 'ONLINE').length,      total: hardware.cameras.length },
                  { label: 'ESP Nodes Online',  value: hardware.espNodes.filter((e) => e.status === 'ONLINE').length,     total: hardware.espNodes.length },
                  { label: 'Microphones Online', value: hardware.microphones.filter((m) => m.status === 'ONLINE').length, total: hardware.microphones.length },
                ].map(({ label, value, total }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-300 font-medium">{value} / {total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: total > 0 ? `${(value / total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Floor-plan map */}
        {center.mapUrl && (
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Floor Plan / Site Map</h3>
              <a
                href={`${process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'}${center.mapUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:underline"
              >
                Open full size ↗
              </a>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000'}${center.mapUrl}`}
              alt={`${center.name} floor plan`}
              className="w-full max-h-[480px] object-contain rounded-xl bg-slate-900 border border-slate-800"
            />
          </div>
        )}

        </div>
      )}

      {/* HARDWARE */}
      {activeTab === 'hardware' && hardware && (
        <div className="space-y-6">
          {/* Cameras */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Cameras ({hardware.cameras.length})
            </h3>
            {hardware.cameras.length === 0 ? (
              <p className="text-sm text-slate-600">No cameras registered</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {hardware.cameras.map((cam) => (
                  <HardwareCard
                    key={cam.id}
                    name={cam.name}
                    detail={cam.ipAddress ?? cam.rtspUrl?.split('@')[1] ?? cam.id}
                    status={cam.status}
                    assigned={cam.assignedTableName}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ESP Nodes */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> ESP Nodes ({hardware.espNodes.length})
            </h3>
            {hardware.espNodes.length === 0 ? (
              <p className="text-sm text-slate-600">No ESP nodes registered</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {hardware.espNodes.map((node) => (
                  <HardwareCard
                    key={node.id}
                    name={node.name}
                    detail={node.macAddress}
                    status={node.status}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Microphones */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Mic className="w-3.5 h-3.5" /> Microphones ({hardware.microphones.length})
            </h3>
            {hardware.microphones.length === 0 ? (
              <p className="text-sm text-slate-600">No microphones registered</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {hardware.microphones.map((mic) => (
                  <HardwareCard
                    key={mic.id}
                    name={mic.name}
                    detail={`${mic.channel} · ${mic.ipAddress ?? mic.model ?? ''}`}
                    status={mic.status}
                    assigned={mic.assignedTableName}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* STAFF */}
      {/* DEVICES */}
      {activeTab === 'devices' && (
        <div className="flex flex-col gap-5">
          {/* Setup Wizard banner — shown once after center creation */}
          {showWizard && (
            <SetupWizard
              centerId={centerId}
              centerName={center.name}
              onComplete={() => {
                setShowWizard(false);
                fetchAll();
                // Remove ?setup=true from URL without full reload
                router.replace(`/super-admin/centers/${centerId}`);
              }}
              onSkip={() => {
                setShowWizard(false);
                router.replace(`/super-admin/centers/${centerId}`);
              }}
            />
          )}
          <DeviceManagerTab centerId={centerId} />
        </div>
      )}

      {/* Edit modal */}
      {showEdit && center && (
        <EditCenterModal
          center={center}
          onSaved={(updated) => { setCenter(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {activeTab === 'staff' && (
        <div>
          {staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
              <Users className="w-8 h-8" />
              <p className="text-sm">No staff assigned to this center</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-slate-300">
                              {(user.firstName?.[0] ?? '').toUpperCase()}
                              {(user.lastName?.[0]  ?? '').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white font-medium">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          user.role === 'ADMIN' ? 'text-cyan-400 bg-cyan-400/10' : 'text-emerald-400 bg-emerald-400/10',
                        )}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          user.isActive ? 'text-emerald-400' : 'text-slate-500',
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', user.isActive ? 'bg-emerald-400' : 'bg-slate-600')} />
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
