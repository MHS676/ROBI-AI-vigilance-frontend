'use client';

/**
 * UnifiedStatusMatrix
 * ────────────────────
 * Displays all 20 enterprise security objectives in a single live table.
 *
 * Each row shows:
 *  • Row number + label
 *  • Source technology icons (📷 CCTV  📡 WiFi  🎙️ Audio)
 *  • Live status badge (NORMAL / WARNING / ALERT / INACTIVE)
 *  • Confidence score (last trigger, 0–100 %)
 *  • Hybrid Toggle — Super Admin can flip primary source to save GPU VRAM
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAlertsStore } from '@/store/alerts.store';
import type { ObjectiveStatus, HybridSourceConfig } from '@/types';

// ─── 20 Enterprise Objectives catalogue ──────────────────────────────────────
interface ObjDef {
  id: number;
  label: string;
  short: string;
  sources: ('CCTV' | 'WIFI' | 'AUDIO')[];
  highCompute: boolean;
  wsEvents: string[];
}

export const OBJECTIVES: ObjDef[] = [
  { id:  1, label: 'Excess Waiting Customers',         short: 'Excess Wait',      sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:crowd_detected']        },
  { id:  2, label: 'Idle Agents / Empty Counters',     short: 'Idle Agent',       sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:idle_agent']            },
  { id:  3, label: 'Identifying Irate Customers',      short: 'Irate Customer',   sources: ['CCTV'],                highCompute: true,  wsEvents: ['alert:irate_customer']        },
  { id:  4, label: 'Vandalism / Slang / Shouting',     short: 'Vandalism',        sources: ['AUDIO', 'CCTV'],       highCompute: false, wsEvents: ['alert:vandalism_detected', 'alert:high_audio_level'] },
  { id:  5, label: 'Agent Entry & Exit Notification',  short: 'Agent Entry/Exit', sources: ['CCTV'],                highCompute: true,  wsEvents: []                              },
  { id:  6, label: 'Individual Staying Too Long',      short: 'Long Stay',        sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:long_stay']             },
  { id:  7, label: 'Instant Token Issuance',           short: 'Token Issuance',   sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: []                              },
  { id:  8, label: 'Identifying Empty Counters',       short: 'Empty Counter',    sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:idle_agent']            },
  { id:  9, label: 'Service ON, No Customer',          short: 'Ghost Service',    sources: ['WIFI', 'CCTV'],        highCompute: false, wsEvents: ['alert:ghost_token']           },
  { id: 10, label: 'Long Time Serving Customers',      short: 'Long Service',     sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:long_service']          },
  { id: 11, label: 'Shutter Down During Office Hour',  short: 'Shutter Down',     sources: ['CCTV'],                highCompute: false, wsEvents: []                              },
  { id: 12, label: 'Agent Facial Expression Monitor',  short: 'Agent Facial',     sources: ['CCTV'],                highCompute: true,  wsEvents: ['alert:irate_customer']        },
  { id: 13, label: 'Customer Sentiment (Facial)',      short: 'Customer Facial',  sources: ['CCTV'],                highCompute: true,  wsEvents: []                              },
  { id: 14, label: 'Power Cut / High Temp / Fire',     short: 'Fire / Hazard',    sources: ['CCTV', 'AUDIO'],       highCompute: false, wsEvents: ['alert:fire_detected']         },
  { id: 15, label: 'Weapon / Explosive Detection',     short: 'Weapon',           sources: ['CCTV'],                highCompute: true,  wsEvents: ['alert:weapon_detected']       },
  { id: 16, label: 'Sudden Sick / Incapacitated',      short: 'Sudden Sick',      sources: ['WIFI', 'CCTV'],        highCompute: false, wsEvents: ['alert:sick_detected', 'alert:fall_detected'] },
  { id: 17, label: 'Physically Challenged Visitors',   short: 'Challenged',       sources: ['CCTV'],                highCompute: true,  wsEvents: ['alert:challenged_visitor']    },
  { id: 18, label: 'Agent & Customer Speech-to-Text',  short: 'Speech to Text',   sources: ['AUDIO'],               highCompute: false, wsEvents: []                              },
  { id: 19, label: 'Repeated Customer Visit',          short: 'Repeated Visit',   sources: ['CCTV'],                highCompute: true,  wsEvents: ['alert:repeated_visit']        },
  { id: 20, label: 'Token Without Physical Visit',     short: 'Ghost Token',      sources: ['CCTV', 'WIFI'],        highCompute: false, wsEvents: ['alert:ghost_token']           },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadges({ sources }: { sources: ObjDef['sources'] }) {
  return (
    <div className="flex items-center gap-1">
      {sources.includes('CCTV')  && <span title="CCTV / AI Vision"  className="text-[15px]">📷</span>}
      {sources.includes('WIFI')  && <span title="WiFi Sees (CSI)"   className="text-[15px]">📡</span>}
      {sources.includes('AUDIO') && <span title="Audio / Microphone" className="text-[15px]">🎙️</span>}
    </div>
  );
}

const STATUS_STYLES: Record<ObjectiveStatus, string> = {
  NORMAL:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  WARNING:  'bg-amber-500/10  text-amber-400  border-amber-500/20',
  ALERT:    'bg-red-500/10    text-red-400    border-red-500/20 animate-pulse',
  INACTIVE: 'bg-slate-700/30  text-slate-500  border-slate-700',
};

const STATUS_DOT: Record<ObjectiveStatus, string> = {
  NORMAL:   'bg-emerald-400',
  WARNING:  'bg-amber-400',
  ALERT:    'bg-red-400 animate-pulse shadow-[0_0_6px_#f87171]',
  INACTIVE: 'bg-slate-600',
};

function StatusBadge({ status }: { status: ObjectiveStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide',
      STATUS_STYLES[status],
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[status])} />
      {status}
    </span>
  );
}

// ─── Hybrid Toggle ────────────────────────────────────────────────────────────
function HybridToggle({
  objectiveId,
  sources,
  config,
  onToggle,
}: {
  objectiveId: number;
  sources: ObjDef['sources'];
  config: HybridSourceConfig | undefined;
  onToggle: (objectiveId: number, preferLowCompute: boolean) => void;
}) {
  const preferLow = config?.preferLowCompute ?? false;
  const hasLowCompute = sources.includes('WIFI') || sources.includes('AUDIO');

  if (!hasLowCompute) {
    return <span className="text-xs text-slate-600 italic">CCTV only</span>;
  }

  return (
    <button
      onClick={() => onToggle(objectiveId, !preferLow)}
      title={preferLow ? 'Switch to CCTV primary' : 'Switch to WiFi/Audio primary (save GPU)'}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200',
        preferLow
          ? 'bg-cyan-500 border-cyan-500'
          : 'bg-slate-700 border-slate-600',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-200',
        preferLow ? 'translate-x-4' : 'translate-x-0.5',
        'mt-px',
      )} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  /** If provided, only show objectives relevant to this center */
  centerId?: string;
  className?: string;
}

export default function UnifiedStatusMatrix({ centerId: _centerId, className }: Props) {
  const objectiveStatuses = useAlertsStore((s) => s.objectiveStatuses);
  const hybridSources     = useAlertsStore((s) => s.hybridSources);
  const setHybridSource   = useAlertsStore((s) => s.setHybridSource);

  const handleToggle = useCallback((objectiveId: number, preferLowCompute: boolean) => {
    const obj = OBJECTIVES.find((o) => o.id === objectiveId);
    if (!obj) return;
    // Determine new primary source based on toggle
    const lowComputeSource = obj.sources.find((s) => s !== 'CCTV') ?? 'WIFI';
    const primarySource = preferLowCompute ? lowComputeSource : 'CCTV';
    setHybridSource({ objectiveId, preferLowCompute, primarySource });
    // NOTE: In production, also call PATCH /ingest/hybrid-source via API
  }, [setHybridSource]);

  // Summary counts for the header
  const alertCount   = OBJECTIVES.filter((o) => objectiveStatuses[o.id]?.status === 'ALERT').length;
  const warningCount = OBJECTIVES.filter((o) => objectiveStatuses[o.id]?.status === 'WARNING').length;
  const gpuSavedCount = Object.values(hybridSources).filter((h) => h.preferLowCompute).length;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white">Unified Security Matrix</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">20 objectives · all sensor sources</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {alertCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">
              🚨 {alertCount} ALERT{alertCount !== 1 ? 'S' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold">
              ⚠️ {warningCount} WARNING{warningCount !== 1 ? 'S' : ''}
            </span>
          )}
          {gpuSavedCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              ⚡ {gpuSavedCount} GPU-saved
            </span>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700/50 bg-slate-900/60">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/60">
              <th className="w-8 py-2.5 pl-3 text-left font-semibold text-slate-400">#</th>
              <th className="py-2.5 px-3 text-left font-semibold text-slate-400">Objective</th>
              <th className="py-2.5 px-2 text-center font-semibold text-slate-400 w-20">Sources</th>
              <th className="py-2.5 px-2 text-center font-semibold text-slate-400 w-24">Status</th>
              <th className="py-2.5 px-2 text-center font-semibold text-slate-400 w-20">Confidence</th>
              <th className="py-2.5 px-3 text-center font-semibold text-slate-400 w-28">
                <span title="Prefer WiFi/Audio over GPU-heavy CCTV model">WiFi/Audio Primary ⚡</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {OBJECTIVES.map((obj, idx) => {
              const live   = objectiveStatuses[obj.id];
              const status = live?.status ?? 'INACTIVE';
              const conf   = live?.confidence ?? null;
              const tech   = live?.lastTech ?? null;
              const hybrid = hybridSources[obj.id];
              const isAlert = status === 'ALERT';
              const isWarn  = status === 'WARNING';

              return (
                <tr
                  key={obj.id}
                  className={cn(
                    'border-b border-slate-800/60 transition-colors',
                    isAlert ? 'bg-red-500/5 hover:bg-red-500/10' :
                    isWarn  ? 'bg-amber-500/5 hover:bg-amber-500/8' :
                    idx % 2 === 0 ? 'bg-transparent hover:bg-slate-800/30' : 'bg-slate-800/20 hover:bg-slate-800/40',
                  )}
                >
                  {/* # */}
                  <td className="py-2.5 pl-3 font-mono text-slate-500 tabular-nums">{obj.id}</td>

                  {/* Objective label */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium leading-tight',
                        isAlert ? 'text-red-300' :
                        isWarn  ? 'text-amber-300' :
                        'text-slate-200',
                      )}>
                        {obj.label}
                      </span>
                      {obj.highCompute && (
                        <span
                          title="High-compute GPU model"
                          className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 font-bold tracking-wide"
                        >
                          GPU
                        </span>
                      )}
                    </div>
                    {tech && (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        via {tech === 'CCTV' ? '📷 CCTV' : tech === 'WIFI' ? '📡 WiFi Sees' : '🎙️ Audio'}
                        {live?.lastSeen && (
                          <span className="ml-1">· {new Date(live.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        )}
                      </p>
                    )}
                  </td>

                  {/* Source icons */}
                  <td className="py-2.5 px-2 text-center">
                    <SourceBadges sources={obj.sources} />
                  </td>

                  {/* Status badge */}
                  <td className="py-2.5 px-2 text-center">
                    <StatusBadge status={status} />
                  </td>

                  {/* Confidence */}
                  <td className="py-2.5 px-2 text-center tabular-nums">
                    {conf !== null ? (
                      <span className={cn(
                        'font-bold',
                        conf >= 85 ? 'text-emerald-400' :
                        conf >= 65 ? 'text-amber-400' :
                        'text-slate-400',
                      )}>
                        {conf.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Hybrid toggle */}
                  <td className="py-2.5 px-3 text-center">
                    <HybridToggle
                      objectiveId={obj.id}
                      sources={obj.sources}
                      config={hybrid}
                      onToggle={handleToggle}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
