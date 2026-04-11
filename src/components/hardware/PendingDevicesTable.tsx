'use client';

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Cpu,
  Mic,
  Camera,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { DeviceInventory } from '@/types';
import { AssignDeviceModal } from './AssignDeviceModal';
import { provisioningApi } from '@/lib/api';

interface Props {
  devices: DeviceInventory[];
  onRefresh: () => void;
}

function DeviceTypeIcon({ type }: { type: DeviceInventory['deviceType'] }) {
  if (type === 'ESP32')         return <Cpu    className="w-4 h-4 text-blue-500" />;
  if (type === 'AI_MICROPHONE') return <Mic    className="w-4 h-4 text-violet-500" />;
  return                               <Camera className="w-4 h-4 text-gray-400" />;
}

function StatusBadge({ status }: { status: DeviceInventory['status'] }) {
  const styles: Record<DeviceInventory['status'], string> = {
    PENDING:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    ASSIGNED: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300',
    OFFLINE:  'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300',
    REJECTED: 'bg-gray-100   text-gray-500   dark:bg-gray-700      dark:text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export function PendingDevicesTable({ devices, onRefresh }: Props) {
  const [assignTarget, setAssignTarget] = useState<DeviceInventory | null>(null);
  const [rejectingId, setRejectingId]   = useState<string | null>(null);

  const handleReject = async (device: DeviceInventory) => {
    if (!confirm(`Reject device ${device.macAddress}? It will be marked as REJECTED.`)) return;
    setRejectingId(device.id);
    try {
      await provisioningApi.rejectDevice(device.id, {
        notes: 'Rejected by Super Admin',
      });
      onRefresh();
    } catch (err: any) {
      console.error('Reject failed:', err);
      alert(err?.response?.data?.message ?? 'Rejection failed');
    } finally {
      setRejectingId(null);
    }
  };

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <CheckCircle className="w-12 h-12 text-green-300 mb-3" />
        <p className="text-sm font-medium">No pending devices</p>
        <p className="text-xs mt-1">All discovered devices have been processed.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">MAC Address</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP / Host</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Firmware</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Last Seen</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {devices.map((device) => (
              <tr
                key={device.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition group"
              >
                {/* Type */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DeviceTypeIcon type={device.deviceType} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {device.deviceType === 'ESP32'
                        ? 'ESP32'
                        : device.deviceType === 'AI_MICROPHONE'
                        ? 'AI Mic'
                        : 'Camera'}
                    </span>
                  </div>
                </td>

                {/* MAC */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200">
                    {device.macAddress ?? '—'}
                  </span>
                </td>

                {/* IP / Host */}
                <td className="px-4 py-3">
                  <div className="text-xs">
                    {device.ipAddress && (
                      <div className="font-mono text-gray-700 dark:text-gray-300">
                        {device.ipAddress}
                      </div>
                    )}
                    {device.hostname && (
                      <div className="text-gray-400">{device.hostname}</div>
                    )}
                    {!device.ipAddress && !device.hostname && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>

                {/* Firmware */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {device.firmwareVer ?? '—'}
                  </span>
                </td>

                {/* Last Seen */}
                <td className="px-4 py-3">
                  {device.lastSeenAt ? (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {new Date(device.lastSeenAt).toLocaleString()}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge status={device.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    {device.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setAssignTarget(device)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                          title="Assign to Center"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Assign
                        </button>
                        <button
                          onClick={() => handleReject(device)}
                          disabled={rejectingId === device.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition disabled:opacity-50"
                          title="Reject Device"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {rejectingId === device.id ? 'Rejecting…' : 'Reject'}
                        </button>
                      </>
                    )}
                    {device.status === 'ASSIGNED' && (
                      <button
                        onClick={() => setAssignTarget(device)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium transition"
                        title="Re-provision"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-provision
                      </button>
                    )}
                    {device.status === 'REJECTED' && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Rejected
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignDeviceModal
          device={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => {
            setAssignTarget(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
