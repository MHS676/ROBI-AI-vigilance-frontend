'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Wifi, Building2, Loader2, CheckCircle } from 'lucide-react';
import type { DeviceInventory, Center, AssignDeviceDto } from '@/types';
import { centersApi, provisioningApi } from '@/lib/api';

// ─── Zod Schema ────────────────────────────────────────────────────────────────
const assignSchema = z.object({
  centerId:    z.string().min(1, 'Select a center'),
  tableId:     z.string().optional(),
  wifiSsid:    z.string().min(1, 'WiFi SSID is required').max(64),
  wifiPassword:z.string().min(8, 'Password must be at least 8 characters').max(64),
  notes:       z.string().max(500).optional(),
});

type AssignFormValues = z.infer<typeof assignSchema>;

interface Props {
  device: DeviceInventory;
  onClose: () => void;
  onSuccess: (updated: DeviceInventory) => void;
}

export function AssignDeviceModal({ device, onClose, onSuccess }: Props) {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCenters, setFetchingCenters] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      centerId:    device.centerId ?? '',
      wifiSsid:    '',
      wifiPassword:'',
    },
  });

  // Load centers
  useEffect(() => {
    centersApi
      .getAll({ isActive: true })
      .then((res) => setCenters(res.data))
      .catch(console.error)
      .finally(() => setFetchingCenters(false));
  }, []);

  const onSubmit = async (values: AssignFormValues) => {
    setLoading(true);
    try {
      const dto: AssignDeviceDto = {
        centerId:     values.centerId,
        tableId:      values.tableId || undefined,
        wifiSsid:     values.wifiSsid,
        wifiPassword: values.wifiPassword,
        notes:        values.notes,
      };
      const res = await provisioningApi.assignDevice(device.id, dto);
      onSuccess(res.data);
    } catch (err: any) {
      console.error('Assign failed:', err);
      alert(err?.response?.data?.message ?? 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  const deviceLabel =
    device.deviceType === 'ESP32'
      ? '🔵 ESP32 Node'
      : device.deviceType === 'AI_MICROPHONE'
      ? '🎙️ AI Microphone'
      : '📷 Camera';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Assign Device to Center
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {deviceLabel} · <span className="font-mono text-xs">{device.macAddress}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Device Info Banner */}
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300 space-y-1">
          {device.ipAddress  && <div>IP: <span className="font-mono">{device.ipAddress}</span></div>}
          {device.firmwareVer && <div>Firmware: <span className="font-mono">{device.firmwareVer}</span></div>}
          {device.hostname   && <div>Hostname: <span className="font-mono">{device.hostname}</span></div>}
          {device.lastSeenAt && (
            <div>Last Seen: {new Date(device.lastSeenAt).toLocaleString()}</div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Center Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Building2 className="inline w-4 h-4 mr-1" />
              Assign to Center <span className="text-red-500">*</span>
            </label>
            {fetchingCenters ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading centers…
              </div>
            ) : (
              <select
                {...register('centerId')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Select a center —</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            )}
            {errors.centerId && (
              <p className="text-red-500 text-xs mt-1">{errors.centerId.message}</p>
            )}
          </div>

          {/* WiFi Credentials */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1">
              <Wifi className="w-4 h-4" />
              Branch WiFi Credentials
              <span className="text-xs text-gray-400 font-normal ml-1">(pushed to device via MQTT)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  SSID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FalconBranch-LGS001"
                  {...register('wifiSsid')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {errors.wifiSsid && (
                  <p className="text-red-500 text-xs mt-1">{errors.wifiSsid.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  {...register('wifiPassword')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {errors.wifiPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.wifiPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Admin Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Deployed at Teller Row A, left side"
              {...register('notes')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning…</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Assign &amp; Provision</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
