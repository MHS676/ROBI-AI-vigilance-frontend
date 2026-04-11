'use client';

/**
 * ResourceSaverPanel
 * ──────────────────
 * GPU Optimization control panel for the Super Admin dashboard.
 *
 * Shows:
 *  • Global Resource Saver Mode toggle
 *  • Explanation of the GPU gate logic
 *  • Real-time counts: cameras in standby vs active inference
 *  • Confidence threshold note
 */

import { cn } from '@/lib/utils';
import { useAlertsStore } from '@/store/alerts.store';
import { Zap, ZapOff, Cpu, Info, ShieldCheck, Wifi, Mic } from 'lucide-react';

export default function ResourceSaverPanel({ className }: { className?: string }) {
  const resourceSaverGlobal  = useAlertsStore((s) => s.resourceSaverGlobal);
  const setResourceSaver     = useAlertsStore((s) => s.setResourceSaver);
  const hybridSources        = useAlertsStore((s) => s.hybridSources);

  const gpuSavedCount = Object.values(hybridSources).filter((h) => h.preferLowCompute).length;
  const totalObjectives = 20;

  // Toggle global mode (in real usage this would also PATCH /ingest/resource-saver)
  const toggle = () => setResourceSaver(!resourceSaverGlobal);

  return (
    <div className={cn('rounded-2xl border bg-slate-900 flex flex-col gap-0', className,
      resourceSaverGlobal
        ? 'border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]'
        : 'border-slate-700/50',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            resourceSaverGlobal ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-700/50 text-slate-400',
          )}>
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">GPU Optimization</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Resource Saver Mode</p>
          </div>
        </div>

        {/* Master toggle */}
        <button
          onClick={toggle}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
            resourceSaverGlobal
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
              : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700',
          )}
        >
          {resourceSaverGlobal ? (
            <><Zap className="w-3.5 h-3.5" /> ACTIVE</>
          ) : (
            <><ZapOff className="w-3.5 h-3.5" /> DISABLED</>
          )}
        </button>
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-3 divide-x divide-slate-800 px-0">
        {[
          {
            icon: Cpu,
            label: 'GPU-Heavy Models',
            value: resourceSaverGlobal ? 'STANDBY' : 'ACTIVE',
            sub:   'CCTV face/weapon AI',
            color: resourceSaverGlobal ? 'text-amber-400' : 'text-emerald-400',
          },
          {
            icon: Wifi,
            label: 'WiFi/Audio Priority',
            value: `${gpuSavedCount} / ${totalObjectives}`,
            sub:   'objectives prefer low-compute',
            color: gpuSavedCount > 0 ? 'text-cyan-400' : 'text-slate-500',
          },
          {
            icon: ShieldCheck,
            label: 'GPU Gate Window',
            value: '30 s',
            sub:   'after sensor anomaly arms GPU',
            color: 'text-purple-400',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Icon className={cn('w-3.5 h-3.5', color)} />
              <span className="text-[10px] text-slate-500 font-medium">{label}</span>
            </div>
            <p className={cn('text-sm font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-slate-600">{sub}</p>
          </div>
        ))}
      </div>

      {/* Info blurb */}
      <div className={cn(
        'mx-4 mb-4 mt-1 px-3 py-2.5 rounded-xl border text-xs transition-all',
        resourceSaverGlobal
          ? 'bg-cyan-500/5 border-cyan-500/15 text-cyan-300/80'
          : 'bg-slate-800/50 border-slate-700/50 text-slate-500',
      )}>
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {resourceSaverGlobal ? (
            <p>
              <span className="font-semibold text-cyan-400">Resource Saver ON</span> — High-compute CCTV models
              (weapon detection, face recognition) are <span className="font-semibold">dormant</span>.
              They activate for 30 s only after WiFi Sees or Audio AI detects an initial anomaly,
              then return to standby. Estimated GPU VRAM reduction:{' '}
              <span className="font-semibold text-cyan-400">~60%</span>.
            </p>
          ) : (
            <p>
              All CCTV AI models are running continuously. Enable Resource Saver Mode to let
              WiFi Sees and Audio AI act as a <span className="font-semibold text-slate-300">pre-filter</span>,
              waking GPU-heavy models only when needed.
            </p>
          )}
        </div>
      </div>

      {/* Per-source legend */}
      <div className="flex items-center gap-4 px-4 pb-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><span>📷</span> CCTV (GPU)</span>
        <span className="flex items-center gap-1"><Wifi className="w-3 h-3 text-cyan-600" /> WiFi Sees (low power)</span>
        <span className="flex items-center gap-1"><Mic className="w-3 h-3 text-purple-600" /> Audio AI (low power)</span>
      </div>
    </div>
  );
}
