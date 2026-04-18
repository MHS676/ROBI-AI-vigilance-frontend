'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Mic,
  Camera,
  Wifi,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ScanLine,
  ChevronDown,
  ShieldAlert,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { provisioningApi } from '@/lib/api';
import type {
  DeviceInventory,
  InventoryStats,
  InventoryStatus,
  InventoryDeviceType,
} from '@/types';
import { PendingDevicesTable } from '@/components/hardware/PendingDevicesTable';
import { CameraDiscoveryModal } from '@/components/hardware/CameraDiscoveryModal';
import { useSocket } from '@/hooks/useSocket';

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS: { label: string; value: InventoryStatus | 'ALL' }[] = [
  { label: 'All',      value: 'ALL' },
  { label: 'Pending',  value: 'PENDING' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Offline',  value: 'OFFLINE' },
  { label: 'Rejected', value: 'REJECTED' },
];

const TYPE_FILTERS: { label: string; value: InventoryDeviceType | 'ALL' }[] = [
  { label: 'All Types',      value: 'ALL' },
  { label: 'ESP32',          value: 'ESP32' },
  { label: 'AI Microphone',  value: 'AI_MICROPHONE' },
  { label: 'Camera',         value: 'CAMERA' },
];

export default function ProvisioningClient() {
  const [stats,    setStats]    = useState<InventoryStats | null>(null);
  const [devices,  setDevices]  = useState<DeviceInventory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [activeStatus, setActiveStatus] = useState<InventoryStatus | 'ALL'>('PENDING');
  const [activeType,   setActiveType]   = useState<InventoryDeviceType | 'ALL'>('ALL');
  const [showCameraScan, setShowCameraScan] = useState(false);

  // ── Socket: real-time device discovery notifications ────────────────────────
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handleDiscovered = () => fetchData();
    const handleProvisioned = () => fetchData();
    const handleRejected = () => fetchData();

    socket.on('provisioning:device_discovered', handleDiscovered);
    socket.on('provisioning:device_provisioned', handleProvisioned);
    socket.on('provisioning:device_rejected',   handleRejected);

    return () => {
      socket.off('provisioning:device_discovered', handleDiscovered);
      socket.off('provisioning:device_provisioned', handleProvisioned);
      socket.off('provisioning:device_rejected',   handleRejected);
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, devicesRes] = await Promise.all([
        provisioningApi.getStats(),
        provisioningApi.getAllDevices({
          status:     activeStatus !== 'ALL'  ? activeStatus  : undefined,
          deviceType: activeType   !== 'ALL'  ? activeType    : undefined,
        }),
      ]);
      setStats(statsRes.data);
      setDevices(devicesRes.data);
    } catch (err) {
      console.error('Failed to fetch provisioning data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, activeType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Pending count badge ────────────────────────────────────────────────────
  const pendingCount = stats?.pending ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-blue-500" />
            Hardware Provisioning
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Zero-Configuration device onboarding — approve discovered devices and scan for cameras.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCameraScan(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            <ScanLine className="w-4 h-4" />
            Scan for Cameras
          </button>
        </div>
      </div>

      {/* ── Pending Alert Banner ─────────────────────────────────── */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>{pendingCount}</strong> device{pendingCount > 1 ? 's' : ''} waiting for your
            approval. Review them below and click{' '}
            <strong>Assign &amp; Provision</strong> to configure automatically.
          </p>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Devices"
          value={stats?.total ?? 0}
          icon={Cpu}
          color="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        />
        <StatCard
          label="Pending Approval"
          value={stats?.pending ?? 0}
          icon={Clock}
          color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
        <StatCard
          label="Assigned"
          value={stats?.assigned ?? 0}
          icon={CheckCircle}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
        <StatCard
          label="Offline"
          value={stats?.offline ?? 0}
          icon={Wifi}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          label="Rejected"
          value={stats?.rejected ?? 0}
          icon={XCircle}
          color="bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
        />
      </div>

      {/* ── Device Inventory Table ────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Table Header + Filters */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Device Inventory
            </h2>

            {/* Type filter */}
            <div className="relative">
              <select
                value={activeType}
                onChange={(e) => setActiveType(e.target.value as InventoryDeviceType | 'ALL')}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {TYPE_FILTERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveStatus(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeStatus === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
                {tab.value === 'PENDING' && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm">Loading inventory…</span>
          </div>
        ) : (
          <PendingDevicesTable devices={devices} onRefresh={fetchData} />
        )}
      </div>

      {/* ── MQTT Birth Message Guide ──────────────────────────────── */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-500" />
          How Zero-Config Works
        </h3>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal pl-5">
          <li>
            <strong>Power On</strong> — When an ESP32 or AI-Microphone is powered on, it publishes
            its MAC address and firmware version to{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs font-mono">
              falcon/discovery/pending
            </code>
          </li>
          <li>
            <strong>Auto-Discovery</strong> — This page updates in real-time. The device appears in
            the{' '}
            <strong className="text-yellow-600 dark:text-yellow-400">Pending</strong> list above.
          </li>
          <li>
            <strong>Super Admin Approves</strong> — Click{' '}
            <strong>Assign &amp; Provision</strong>, select the center and enter the branch WiFi
            credentials.
          </li>
          <li>
            <strong>Automatic Configuration</strong> — The backend publishes the provisioning config
            (Center ID, Table ID, WiFi) to{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs font-mono">
              falcon/provision/&#123;MAC&#125;
            </code>
            . The device auto-connects.
          </li>
          <li>
            <strong>Cameras</strong> — Click{' '}
            <strong>Scan for Cameras</strong> to run an ONVIF discovery on any branch subnet.
            Hikvision and Tiandy cameras respond automatically.
          </li>
        </ol>
      </div>

      {/* ── Camera Discovery Modal ────────────────────────────────── */}
      {showCameraScan && (
        <CameraDiscoveryModal
          onClose={() => setShowCameraScan(false)}
          onCameraAdded={fetchData}
        />
      )}
    </div>
  );
}
