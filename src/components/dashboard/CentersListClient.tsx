'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Building2, RefreshCw, Search, MapPin, CheckCircle2, XCircle,
  ChevronRight, Plus, Pencil, Trash2, X, AlertTriangle, Loader2,
} from 'lucide-react';
import { centersApi } from '@/lib/api';
import type { Center } from '@/types';
import { cn } from '@/lib/utils';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

// ─── Inline Edit Modal ────────────────────────────────────────────────────────
interface EditForm {
  name: string; code: string; address: string;
  city: string; state: string; country: string; phone: string;
}

function EditModal({
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

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-cyan-400" />
            <p className="text-sm font-semibold text-white">Edit Center</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {([
            { k: 'name'    as keyof EditForm, label: 'Center Name *',  placeholder: 'Falcon Branch — Abuja' },
            { k: 'code'    as keyof EditForm, label: 'Branch Code *',  placeholder: 'FAL-ABJ-002' },
            { k: 'address' as keyof EditForm, label: 'Street Address', placeholder: '14 Broad Street' },
            { k: 'city'    as keyof EditForm, label: 'City',           placeholder: 'Lagos Island' },
            { k: 'state'   as keyof EditForm, label: 'State',          placeholder: 'Lagos' },
            { k: 'country' as keyof EditForm, label: 'Country',        placeholder: 'Nigeria' },
            { k: 'phone'   as keyof EditForm, label: 'Phone',          placeholder: '+234-800-FALCON-1' },
          ]).map(({ k, label, placeholder }) => (
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

// ─── Main List ────────────────────────────────────────────────────────────────
export default function CentersListClient() {
  const [items,      setItems]      = useState<Center[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<Filter>('ALL');
  const [editCenter, setEditCenter] = useState<Center | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { data } = await centersApi.getAll({}); setItems(data); }
    catch { setError('Failed to load centers.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = useCallback(async (center: Center) => {
    if (!confirm(`Deactivate "${center.name}"? It will be hidden from active lists.`)) return;
    setDeletingId(center.id);
    try {
      await centersApi.remove(center.id);
      setItems((prev) => prev.map((c) => c.id === center.id ? { ...c, isActive: false } : c));
    } catch {
      alert('Failed to deactivate center');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleReactivate = useCallback(async (center: Center) => {
    if (!confirm(`Reactivate "${center.name}"?`)) return;
    setDeletingId(center.id);
    try {
      const { data } = await centersApi.update(center.id, { isActive: true });
      setItems((prev) => prev.map((c) => c.id === center.id ? data : c));
    } catch {
      alert('Failed to reactivate center');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    const matchFilter =
      filter === 'ALL' ||
      (filter === 'ACTIVE'   &&  c.isActive) ||
      (filter === 'INACTIVE' && !c.isActive);
    return (
      matchFilter &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.state ?? '').toLowerCase().includes(q))
    );
  });

  const activeCount = items.filter((c) => c.isActive).length;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">All Centers</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? 'Loading…' : (
              <>
                {items.length} centers ·{' '}
                <span className="text-emerald-400">{activeCount} active</span> ·{' '}
                <span className="text-slate-500">{items.length - activeCount} inactive</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </button>
          <Link
            href="/super-admin/centers/new"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Register Center
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 shrink-0">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, city…"
            className="w-full h-9 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-lg transition-all',
                filter === f
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Building2 className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={load} className="text-xs text-cyan-400 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
            <Building2 className="w-8 h-8" />
            <p className="text-sm">No centers match your filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((center) => (
              <div
                key={center.id}
                className="group relative flex flex-col gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <StatusBadge active={center.isActive} />
                </div>

                {/* Name & code */}
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{center.name}</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">{center.code}</p>
                </div>

                {/* Location */}
                {(center.city || center.state) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{[center.city, center.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
                  <Link
                    href={`/super-admin/centers/${center.id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition flex-1 justify-center"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditCenter(center); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-cyan-400 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition"
                    title="Edit center"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      center.isActive
                        ? handleDeactivate(center)
                        : handleReactivate(center);
                    }}
                    disabled={deletingId === center.id}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 rounded-lg transition disabled:opacity-50',
                      center.isActive
                        ? 'text-slate-400 hover:text-red-400'
                        : 'text-slate-500 hover:text-emerald-400',
                    )}
                    title={center.isActive ? 'Deactivate center' : 'Reactivate center'}
                  >
                    {deletingId === center.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : center.isActive
                      ? <Trash2 className="w-3 h-3" />
                      : <CheckCircle2 className="w-3 h-3" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && (
        <p className="text-xs text-slate-600 shrink-0">
          Showing {filtered.length} of {items.length} centers
        </p>
      )}

      {/* Edit modal */}
      {editCenter && (
        <EditModal
          center={editCenter}
          onSaved={(updated) => {
            setItems((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setEditCenter(null);
          }}
          onClose={() => setEditCenter(null)}
        />
      )}
    </div>
  );
}
