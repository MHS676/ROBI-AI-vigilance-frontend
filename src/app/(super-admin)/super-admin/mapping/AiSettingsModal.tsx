'use client';

/**
 * AiSettingsModal
 *
 * Slide-over modal opened from the Hardware Mapping page when a Super Admin
 * clicks the "AI Settings" button on a selected camera.
 *
 * Shows 5 toggle cards — one per AiFeature — and saves changes immediately
 * on each toggle (optimistic UI + server sync).
 *
 * Features:
 *  • Optimistic toggle (instant visual feedback, roll-back on error)
 *  • Per-feature saving spinner
 *  • "Enable All / Disable All" batch actions
 *  • Reads initial state from camera.aiFeatures
 */

import { useState, useCallback, useEffect } from 'react';
import {
  X,
  Bot,
  ShieldAlert,
  Flame,
  Users,
  AlertTriangle,
  PersonStanding,
  CheckCircle2,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { camerasApi } from '@/lib/api';
import type { Camera, AiFeature } from '@/types';
import { AI_FEATURE_META, ALL_AI_FEATURES } from '@/types';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const FEATURE_ICON: Record<AiFeature, React.ReactNode> = {
  WEAPON: <ShieldAlert className="w-5 h-5" />,
  FIGHT:  <AlertTriangle className="w-5 h-5" />,
  FALL:   <PersonStanding className="w-5 h-5" />,
  FIRE:   <Flame className="w-5 h-5" />,
  CROWD:  <Users className="w-5 h-5" />,
};

// Tailwind color classes per feature
const FEATURE_COLOR: Record<AiFeature, { ring: string; bg: string; text: string; badge: string }> = {
  WEAPON: { ring: 'ring-red-500/30',    bg: 'bg-red-500/10',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300' },
  FIGHT:  { ring: 'ring-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
  FALL:   { ring: 'ring-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300' },
  FIRE:   { ring: 'ring-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-300' },
  CROWD:  { ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300' },
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  camera:   Camera | null;
  /** Called after any feature update with the full updated camera */
  onUpdate?: (camera: Camera) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AiSettingsModal({ isOpen, onClose, camera, onUpdate }: Props) {
  // ── Local feature toggles — seeded from camera.aiFeatures ──────────────────
  const [enabled,     setEnabled]     = useState<AiFeature[]>([...ALL_AI_FEATURES]);
  const [saving,      setSaving]      = useState<AiFeature | null>(null);
  const [lastSaved,   setLastSaved]   = useState<AiFeature | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);

  /**
   * Re-seed state whenever the modal is opened for a (different) camera.
   * Using useEffect avoids the setState-during-render anti-pattern that
   * causes "Too many re-renders" when camera is null (undefined !== null).
   */
  useEffect(() => {
    const f = camera?.aiFeatures;
    setEnabled(Array.isArray(f) && f.length > 0 ? [...f] : [...ALL_AI_FEATURES]);
    setError(null);
    setSaving(null);
    setLastSaved(null);
    setBatchSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.id]); // only re-seed when the camera identity changes

  // ── Toggle a single feature ───────────────────────────────────────────────
  const toggle = useCallback(async (feature: AiFeature) => {
    if (!camera || saving || batchSaving) return;
    setError(null);

    const willEnable = !enabled.includes(feature);
    const next = willEnable
      ? [...enabled, feature]
      : enabled.filter((f) => f !== feature);

    // Optimistic update
    setEnabled(next);
    setSaving(feature);

    try {
      const { data } = await camerasApi.updateAiFeatures(camera.id, next);
      onUpdate?.(data);
      setLastSaved(feature);
      setTimeout(() => setLastSaved(null), 1500);
    } catch (err: any) {
      // Roll back on failure
      setEnabled(enabled);
      setError(err?.response?.data?.message ?? 'Failed to save — please retry');
    } finally {
      setSaving(null);
    }
  }, [camera, enabled, saving, batchSaving, onUpdate]);

  // ── Enable all / Disable all ──────────────────────────────────────────────
  const applyBatch = useCallback(async (features: AiFeature[]) => {
    if (!camera || saving || batchSaving) return;
    setError(null);
    setBatchSaving(true);
    const prev = [...enabled];
    setEnabled(features);

    try {
      const { data } = await camerasApi.updateAiFeatures(camera.id, features);
      onUpdate?.(data);
    } catch (err: any) {
      setEnabled(prev);
      setError(err?.response?.data?.message ?? 'Batch update failed — please retry');
    } finally {
      setBatchSaving(false);
    }
  }, [camera, enabled, saving, batchSaving, onUpdate]);

  if (!isOpen || !camera) return null;

  const allOn  = enabled.length === ALL_AI_FEATURES.length;
  const allOff = enabled.length === 0;

  return (
    /* ── Backdrop ──────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">AI Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">
                {camera.name}
                {camera.ipAddress && (
                  <span className="ml-1.5 text-slate-600">({camera.ipAddress})</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-header: batch actions + active count */}
        <div className="px-5 py-3 border-b border-slate-800/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            <span className="text-white font-semibold">{enabled.length}</span>
            {' / '}
            {ALL_AI_FEATURES.length} features enabled
          </p>
          <div className="flex items-center gap-2">
            {(batchSaving) && (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            )}
            <button
              onClick={() => applyBatch([...ALL_AI_FEATURES])}
              disabled={allOn || batchSaving || !!saving}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Enable all
            </button>
            <button
              onClick={() => applyBatch([])}
              disabled={allOff || batchSaving || !!saving}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Disable all
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Feature cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {ALL_AI_FEATURES.map((feature) => {
            const meta    = AI_FEATURE_META[feature];
            const isOn    = enabled.includes(feature);
            const isSav   = saving === feature;
            const isSaved = lastSaved === feature;
            const colors  = FEATURE_COLOR[feature];

            return (
              <div
                key={feature}
                onClick={() => toggle(feature)}
                className={`
                  relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer
                  transition-all duration-200 select-none
                  ${isOn
                    ? `${colors.ring} ${colors.bg} border-transparent ring-1`
                    : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70'}
                  ${(saving && saving !== feature) || batchSaving ? 'opacity-60 pointer-events-none' : ''}
                `}
              >
                {/* Feature icon */}
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                  ${isOn ? `${colors.bg} ${colors.text}` : 'bg-slate-700/40 text-slate-500'}
                `}>
                  {FEATURE_ICON[feature]}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold transition-colors ${isOn ? 'text-white' : 'text-slate-400'}`}>
                      {meta.label}
                    </span>
                    {isOn && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge}`}>
                        ON
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {meta.description}
                  </p>
                </div>

                {/* Toggle / status icon */}
                <div className="shrink-0 ml-2">
                  {isSav ? (
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  ) : isSaved ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isOn ? (
                    <ToggleRight className={`w-7 h-7 ${colors.text}`} />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/50 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Changes are applied immediately to the AI worker and dashboard.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
