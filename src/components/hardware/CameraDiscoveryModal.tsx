'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  Search,
  Loader2,
  Camera,
  Plus,
  CheckCircle,
  Building2,
  Wifi,
  Monitor,
} from 'lucide-react';
import type { DiscoveredCamera, Center, AddDiscoveredCameraDto } from '@/types';
import { provisioningApi, centersApi } from '@/lib/api';

// ─── Scan Form Schema ──────────────────────────────────────────────────────────
const scanSchema = z.object({
  subnet:      z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'e.g. 192.168.1'),
  timeoutMs:   z.coerce.number().min(500).max(10000).optional(),
  concurrency: z.coerce.number().min(1).max(200).optional(),
});
type ScanFormValues = z.infer<typeof scanSchema>;

interface Props {
  onClose: () => void;
  onCameraAdded?: () => void;
}

export function CameraDiscoveryModal({ onClose, onCameraAdded }: Props) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DiscoveredCamera[]>([]);
  const [scanned, setScanned] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [addingIp, setAddingIp] = useState<string | null>(null);
  const [addedIps, setAddedIps] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: { subnet: '192.168.1', timeoutMs: 2000, concurrency: 50 },
  });

  const onScan = async (values: ScanFormValues) => {
    setScanning(true);
    setScanned(false);
    setResults([]);
    try {
      // Also fetch centers if not loaded
      if (centers.length === 0) {
        const cRes = await centersApi.getAll({ isActive: true });
        setCenters(cRes.data);
      }
      const res = await provisioningApi.scanCameras({
        subnet:      values.subnet,
        timeoutMs:   values.timeoutMs,
        concurrency: values.concurrency,
      });
      setResults(res.data);
    } catch (err: any) {
      console.error('Scan failed:', err);
      alert(err?.response?.data?.message ?? 'Scan failed');
    } finally {
      setScanning(false);
      setScanned(true);
    }
  };

  const handleAddCamera = async (cam: DiscoveredCamera) => {
    if (!selectedCenter) {
      alert('Select a center first');
      return;
    }
    setAddingIp(cam.ipAddress);
    try {
      const dto: AddDiscoveredCameraDto = {
        centerId:     selectedCenter,
        ipAddress:    cam.ipAddress,
        manufacturer: cam.manufacturer,
        onvifXAddr:   cam.onvifXAddr,
        rtspUrl:      cam.rtspUrl,
        name:         `${cam.manufacturer ?? 'CAM'} — ${cam.ipAddress}`,
      };
      await provisioningApi.addDiscoveredCamera(dto);
      setAddedIps((prev) => {
        const next = new Set(Array.from(prev));
        next.add(cam.ipAddress);
        return next;
      });
      onCameraAdded?.();
    } catch (err: any) {
      console.error('Add camera failed:', err);
      alert(err?.response?.data?.message ?? 'Failed to add camera');
    } finally {
      setAddingIp(null);
    }
  };

  const methodBadge = (method: DiscoveredCamera['discoveryMethod']) => {
    const map: Record<typeof method, string> = {
      onvif:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'tcp-scan':'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      both:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[method]}`}>
        {method.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              ONVIF Camera Discovery
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Scan branch network for Tiandy / Hikvision cameras via WS-Discovery + TCP probe
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scan Form */}
        <form
          onSubmit={handleSubmit(onScan)}
          className="px-6 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0"
        >
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Subnet (3 octets) *
              </label>
              <input
                type="text"
                placeholder="192.168.1"
                {...register('subnet')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {errors.subnet && (
                <p className="text-red-500 text-xs mt-1">{errors.subnet.message}</p>
              )}
            </div>

            <div className="w-28">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                {...register('timeoutMs')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="w-28">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Concurrency
              </label>
              <input
                type="number"
                {...register('concurrency')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={scanning}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition disabled:opacity-60 shrink-0"
            >
              {scanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
              ) : (
                <><Search className="w-4 h-4" /> Scan Network</>
              )}
            </button>
          </div>
        </form>

        {/* Center Selector (shown after scan) */}
        {scanned && results.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Select center to assign cameras —</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[200px]">
          {scanning && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Scanning network — this may take up to 30 seconds…</p>
            </div>
          )}

          {!scanning && scanned && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-500">
              <Monitor className="w-10 h-10 text-gray-300" />
              <p className="text-sm">No cameras found on this subnet.</p>
              <p className="text-xs text-gray-400">
                Ensure devices are on the same network and ONVIF is enabled.
              </p>
            </div>
          )}

          {!scanning && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Found <strong>{results.length}</strong> device(s)
              </p>
              {results.map((cam) => {
                const added = addedIps.has(cam.ipAddress);
                return (
                  <div
                    key={cam.ipAddress}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600 transition"
                  >
                    <Camera className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                          {cam.ipAddress}
                        </span>
                        {cam.manufacturer && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {cam.manufacturer}
                          </span>
                        )}
                        {methodBadge(cam.discoveryMethod)}
                      </div>
                      {cam.rtspUrl && (
                        <p className="text-xs font-mono text-gray-400 truncate mt-0.5">
                          {cam.rtspUrl}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ports: {cam.ports.join(', ')}
                        {cam.onvifXAddr && ' · ONVIF ✓'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddCamera(cam)}
                      disabled={added || addingIp === cam.ipAddress || !selectedCenter}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50
                        bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                    >
                      {added ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Added</>
                      ) : addingIp === cam.ipAddress ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Add</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!scanned && !scanning && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
              <Wifi className="w-10 h-10 text-gray-300" />
              <p className="text-sm">Enter subnet and click Scan Network to discover cameras.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
