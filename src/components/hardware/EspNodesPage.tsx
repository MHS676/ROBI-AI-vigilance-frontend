'use client';

import { useEffect, useState, useCallback } from 'react';
import { Cpu, RefreshCw, Wifi, WifiOff, AlertTriangle, Search } from 'lucide-react';
import { espNodesApi } from '@/lib/api';
import type { EspNode, DeviceStatus } from '@/types';
import { cn } from '@/lib/utils';

const S_COLOR: Record<DeviceStatus, string> = {
  ONLINE: 'text-emerald-400', OFFLINE: 'text-red-400', MAINTENANCE: 'text-amber-400',
};
const S_BG: Record<DeviceStatus, string> = {
  ONLINE: 'bg-emerald-400/10 border-emerald-400/20',
  OFFLINE: 'bg-red-400/10 border-red-400/20',
  MAINTENANCE: 'bg-amber-400/10 border-amber-400/20',
};
const S_ICON: Record<DeviceStatus, React.ComponentType<{ className?: string }>> = {
  ONLINE: Wifi, OFFLINE: WifiOff, MAINTENANCE: AlertTriangle,
};

export default function EspNodesPage() {
  const [items,   setItems]   = useState<EspNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<DeviceStatus | 'ALL'>('ALL');

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { data } = await espNodesApi.getAll(); setItems(data); }
    catch { setError('Failed to load ESP nodes.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = items.filter((n) => {
    const q = search.toLowerCase();
    return (filter === 'ALL' || n.status === filter) &&
      (!q || n.name.toLowerCase().includes(q) || n.macAddress.toLowerCase().includes(q) || (n.ipAddress ?? '').includes(q));
  });

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">ESP Nodes</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? 'Loading…' : `${items.length} ESP nodes registered`}
          </p>
        </div>
        <button onClick={fetch} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-all disabled:opacity-50">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 shrink-0">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or MAC address…"
            className="w-full h-9 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'ONLINE', 'OFFLINE', 'MAINTENANCE'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-2 text-xs font-medium rounded-lg transition-all',
                filter === f ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                             : 'text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Cpu className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={fetch} className="text-xs text-cyan-400 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
            <Cpu className="w-8 h-8" /><p className="text-sm">No ESP nodes match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {['Name', 'MAC Address', 'IP Address', 'Firmware', 'Status'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((node) => {
                  const Icon = S_ICON[node.status] ?? WifiOff;
                  return (
                    <tr key={node.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">{node.name}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">{node.macAddress}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">{node.ipAddress ?? '—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{node.firmwareVer ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border', S_COLOR[node.status], S_BG[node.status])}>
                          <Icon className="w-3 h-3" />{node.status.charAt(0) + node.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && (
        <p className="text-xs text-slate-600 shrink-0">Showing {filtered.length} of {items.length} nodes</p>
      )}
    </div>
  );
}
