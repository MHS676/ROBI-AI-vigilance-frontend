'use client';

/**
 * LinkTableDrawer — slide-out panel (from right) for linking a drawn camera
 * zone to a Table, Microphone, and Agent.
 *
 * Opens after the user finishes drawing a bounding box.
 * Submits to POST /api/v1/mapping/link-table.
 */

import { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { centersApi, usersApi, mappingApi, type LinkTableDto } from '@/lib/api';
import type { Table, Microphone, User, Center, Camera } from '@/types';
import type { BBoxNorm, BBoxPx } from './BoundingBoxDrawer';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called on successful POST — parent resets the canvas */
  onSuccess: () => void;
  center: Center | null;
  camera: Camera | null;
  boundingBox: BBoxNorm | null;
  /** Pixel-space box used for the actual API submission */
  boundingBoxPx: BBoxPx | null;
}

// ─── Styled <select> wrapper ──────────────────────────────────────────────────
function SelectField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
        {label} *
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="
          w-full h-10 rounded-lg px-3 text-sm text-white
          bg-slate-800/90 border border-slate-700
          focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
          outline-none transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LinkTableDrawer({
  isOpen,
  onClose,
  onSuccess,
  center,
  camera,
  boundingBox,
  boundingBoxPx,
}: Props) {
  // ── Remote data ─────────────────────────────────────────────────────────────
  const [tables,     setTables]     = useState<Table[]>([]);
  const [microphones, setMicrophones] = useState<Microphone[]>([]);
  const [agents,     setAgents]     = useState<User[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError,   setDataError]   = useState<string | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [tableId,      setTableId]      = useState('');
  const [microphoneId, setMicrophoneId] = useState('');
  const [agentId,      setAgentId]      = useState('');

  // ── Submission state ─────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);

  // ── Fetch resources when drawer opens ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !center) return;

    setDataLoading(true);
    setDataError(null);

    Promise.all([
      centersApi.getTables(center.id),
      centersApi.getMicrophones(center.id),
      usersApi.getAll({ centerId: center.id, role: 'AGENT' }),
    ])
      .then(([tablesRes, micsRes, agentsRes]) => {
        setTables(tablesRes.data);
        setMicrophones(micsRes.data);
        setAgents(agentsRes.data);
      })
      .catch(() => setDataError('Could not load center resources. Is the API running?'))
      .finally(() => setDataLoading(false));
  }, [isOpen, center]);

  // ── Reset form when drawer closes ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setTableId('');
      setMicrophoneId('');
      setAgentId('');
      setSubmitError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!center || !camera || !boundingBox || !boundingBoxPx) return;
    if (!tableId || !microphoneId || !agentId) {
      setSubmitError('Please fill in all three fields.');
      return;
    }

    const dto: LinkTableDto = {
      centerId:    center.id,
      cameraId:    camera.id,
      tableId,
      boundingBox: {
        x: Math.round(boundingBoxPx.x),
        y: Math.round(boundingBoxPx.y),
        w: Math.round(boundingBoxPx.width),
        h: Math.round(boundingBoxPx.height),
      },
      microphoneId,
      agentId,
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      await mappingApi.linkTable(dto);
      setSuccess(true);
      // Auto-close after success banner shown
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message ?? 'Linking failed — please try again.';
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !success && !!tableId && !!microphoneId && !!agentId;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        className={`
          fixed inset-0 z-40 transition-all duration-300
          ${isOpen ? 'bg-slate-950/60 backdrop-blur-sm pointer-events-auto' : 'bg-transparent pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Slide-in panel ────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-96 z-50
          bg-slate-900 border-l border-slate-800 shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Link table zone drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Link Table Zone
            </h2>
            {center && camera && (
              <p className="text-xs text-slate-500 mt-0.5">
                {center.name} &middot; {camera.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Bounding box info ─────────────────────────────────────────── */}
          {boundingBox && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Zone Coordinates (normalized 0–1)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((k) => (
                  <div key={k} className="bg-slate-900/60 rounded-lg px-3 py-2">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{k}</span>
                    <span className="text-sm font-mono text-cyan-400">
                      {boundingBox[k].toFixed(4)}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-1">
                      ({(boundingBox[k] * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {dataLoading && (
            <div className="flex items-center justify-center py-10 gap-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-sm text-slate-400">Loading center resources…</span>
            </div>
          )}

          {/* ── Load error ────────────────────────────────────────────────── */}
          {dataError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{dataError}</p>
            </div>
          )}

          {/* ── Form fields ───────────────────────────────────────────────── */}
          {!dataLoading && !dataError && (
            <div className="space-y-5">

              {/* Table */}
              <SelectField
                label="Table"
                value={tableId}
                onChange={setTableId}
                placeholder="— Select a table —"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.tableNumber} · {t.name}
                    {t.cameraId ? ' ⚠ already linked' : ''}
                  </option>
                ))}
              </SelectField>
              {tables.length === 0 && (
                <p className="text-xs text-slate-500 -mt-3">
                  No tables found for this center.
                </p>
              )}

              {/* Microphone */}
              <SelectField
                label="Microphone"
                value={microphoneId}
                onChange={setMicrophoneId}
                placeholder="— Select a microphone —"
              >
                {microphones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.channel} channel
                  </option>
                ))}
              </SelectField>
              {microphones.length === 0 && (
                <p className="text-xs text-slate-500 -mt-3">
                  No microphones found for this center.
                </p>
              )}

              {/* Agent */}
              <SelectField
                label="Agent"
                value={agentId}
                onChange={setAgentId}
                placeholder="— Assign an agent —"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </SelectField>
              {agents.length === 0 && (
                <p className="text-xs text-slate-500 -mt-3">
                  No agents found for this center.
                </p>
              )}
            </div>
          )}

          {/* ── Submit error ──────────────────────────────────────────────── */}
          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{submitError}</p>
            </div>
          )}

          {/* ── Success banner ────────────────────────────────────────────── */}
          {success && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300 font-medium">
                Zone linked successfully! Canvas will reset.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 h-10 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="
              flex-1 h-10 rounded-lg text-sm font-semibold
              flex items-center justify-center gap-2
              bg-cyan-500 text-slate-900
              hover:bg-cyan-400 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-cyan-500/20
            "
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Linking…
              </>
            ) : (
              <>
                Link Zone
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
