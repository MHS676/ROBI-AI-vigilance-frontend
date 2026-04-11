'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table2, RefreshCw, Search, CheckCircle2, XCircle } from 'lucide-react';
import { tablesApi } from '@/lib/api';
import type { Table } from '@/types';
import { cn } from '@/lib/utils';

export default function TablesPage() {
  const [items,   setItems]   = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { data } = await tablesApi.getAll(); setItems(data); }
    catch { setError('Failed to load tables.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = items.filter((t) => {
    const q = search.toLowerCase();
    const matchFilter =
      filter === 'ALL' ||
      (filter === 'ACTIVE'   && t.isActive) ||
      (filter === 'INACTIVE' && !t.isActive);
    return matchFilter && (!q || t.name.toLowerCase().includes(q) || String(t.tableNumber).includes(q));
  });

  const linked   = items.filter((t) => t.cameraId && t.microphoneId && t.agentId).length;
  const unlinked = items.length - linked;

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Tables</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? 'Loading…' : (
              <>{items.length} tables · <span className="text-emerald-400">{linked} linked</span> · <span className="text-slate-500">{unlinked} unlinked</span></>
            )}
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
            placeholder="Search by name or number…"
            className="w-full h-9 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((f) => (
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
            <Table2 className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={fetch} className="text-xs text-cyan-400 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
            <Table2 className="w-8 h-8" /><p className="text-sm">No tables match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {['#', 'Name', 'Camera', 'Microphone', 'Agent', 'Status'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">{t.tableNumber}</td>
                    <td className="py-3 px-4 font-medium text-white">{t.name}</td>
                    <td className="py-3 px-4">
                      {t.cameraId
                        ? <span className="text-xs text-emerald-400 font-mono">{t.cameraId.slice(0, 8)}…</span>
                        : <span className="text-xs text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {t.microphoneId
                        ? <span className="text-xs text-violet-400 font-mono">{t.microphoneId.slice(0, 8)}…</span>
                        : <span className="text-xs text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {t.agentId
                        ? <span className="text-xs text-cyan-400 font-mono">{t.agentId.slice(0, 8)}…</span>
                        : <span className="text-xs text-slate-700">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {t.isActive
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" />Active</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-slate-500"><XCircle className="w-3 h-3" />Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && (
        <p className="text-xs text-slate-600 shrink-0">Showing {filtered.length} of {items.length} tables</p>
      )}
    </div>
  );
}
