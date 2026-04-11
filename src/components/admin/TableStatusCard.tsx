'use client';

/**
 * TableStatusCard — real-time status card for a single mapped table.
 *
 * Data is merged from three WebSocket event streams:
 *   update:ai_results   → agent presence, customer count, fall/aggression
 *   update:wifi_sensing → WiFi-based customer presence, wait time
 *   update:audio_level  → decibel level, audio alert flag
 *
 * Visual features:
 *   - Cyan pulse ring when data arrived in the last 5 seconds
 *   - Red "FALL" / orange "AGGRESSION" / yellow "AUDIO" alert badges
 *   - Audio level bar (green → amber → red)
 *   - Customer count combining AI + WiFi estimates
 *   - Agent presence indicator
 *   - Formatted wait time
 */

import { useMemo } from 'react';
import { UserCheck, UserX, Clock, Volume2, Wifi, Brain } from 'lucide-react';
import type { Table, TableStatus } from '@/types';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  table: Table;
  /** Latest real-time state. undefined = no WS data received yet */
  status?: TableStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatWaitTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60)  return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function decibelColor(db: number): string {
  if (db >= 85) return 'bg-red-500';
  if (db >= 70) return 'bg-amber-400';
  if (db >= 50) return 'bg-emerald-400';
  return 'bg-slate-600';
}

function decibelWidth(db: number): number {
  // Normalize 30–100 dB → 0–100%
  return Math.min(100, Math.max(0, ((db - 30) / 70) * 100));
}

/** Returns true if data is fresh (within last 5 seconds) */
function isFresh(lastUpdated: string | undefined): boolean {
  if (!lastUpdated) return false;
  return Date.now() - new Date(lastUpdated).getTime() < 5_000;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TableStatusCard({ table, status }: Props) {
  const hasData  = !!status;
  const fresh    = isFresh(status?.lastUpdated);

  // Derive merged customer count (prefer AI when both sources agree)
  const customerCount = useMemo(() => {
    if (!hasData) return null;
    const ai   = status!.customerCount;
    const wifi = status!.wifiEstimatedCount;
    // Use AI if both are non-zero, otherwise whichever is non-zero
    if (ai > 0 && wifi > 0) return Math.max(ai, wifi);
    return ai || wifi || 0;
  }, [hasData, status]);

  // Alert severity (drives border / badge color)
  const hasFall        = status?.isFallDetected       ?? false;
  const hasAggression  = status?.isAggressionDetected ?? false;
  const hasAudioAlert  = status?.isAudioAlert         ?? false;
  const hasAnyAlert    = hasFall || hasAggression || hasAudioAlert;

  return (
    <div
      className={cn(
        'relative glass rounded-xl p-4 flex flex-col gap-3 transition-all duration-300',
        // Alert borders
        hasFall       && 'border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.15)]',
        hasAggression && !hasFall && 'border-orange-500/40 shadow-[0_0_14px_rgba(249,115,22,0.12)]',
        hasAudioAlert && !hasFall && !hasAggression && 'border-amber-500/30',
        // Fresh data pulse ring
        fresh && !hasAnyAlert && 'border-cyan-500/30',
      )}
    >
      {/* Fresh-data animated ring */}
      {fresh && (
        <div className="absolute inset-0 rounded-xl border border-cyan-500/25 animate-ping pointer-events-none" />
      )}

      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Table number badge */}
          <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-400">
            {table.tableNumber}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {table.name}
            </p>
            {!hasData && (
              <p className="text-[10px] text-slate-600 mt-0.5">Awaiting data…</p>
            )}
          </div>
        </div>

        {/* Alert badges */}
        <div className="flex items-center gap-1 shrink-0">
          {hasFall && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400 animate-pulse">
              FALL
            </span>
          )}
          {hasAggression && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-bold text-orange-400 animate-pulse">
              AGGR
            </span>
          )}
          {hasAudioAlert && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
              AUDIO
            </span>
          )}
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">

        {/* Agent */}
        <div className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-lg p-2.5',
          !hasData ? 'bg-slate-800/40' :
          status!.agentPresent
            ? 'bg-emerald-500/8 border border-emerald-500/20'
            : 'bg-slate-800/40 border border-slate-700/50',
        )}>
          {!hasData || status!.agentPresent
            ? <UserCheck className={cn('w-4 h-4', !hasData ? 'text-slate-600' : 'text-emerald-400')} />
            : <UserX     className="w-4 h-4 text-slate-600" />
          }
          <span className={cn(
            'text-[10px] font-medium',
            !hasData ? 'text-slate-600' :
            status!.agentPresent ? 'text-emerald-400' : 'text-slate-500',
          )}>
            {!hasData ? '—' : status!.agentPresent ? 'Agent on' : 'Agent off'}
          </span>
        </div>

        {/* Customer count */}
        <div className="flex flex-col items-center justify-center gap-1 bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
          <span className={cn(
            'text-xl font-bold tabular-nums leading-none',
            !hasData ? 'text-slate-600' :
            (customerCount ?? 0) > 0 ? 'text-white' : 'text-slate-500',
          )}>
            {!hasData ? '—' : (customerCount ?? 0)}
          </span>
          <span className="text-[10px] text-slate-500">customers</span>
        </div>

        {/* Wait time */}
        <div className="flex flex-col items-center justify-center gap-1 bg-slate-800/40 rounded-lg p-2.5 border border-slate-700/50">
          <Clock className={cn('w-4 h-4', !hasData || !status!.waitTimeSeconds ? 'text-slate-600' : 'text-amber-400')} />
          <span className={cn(
            'text-[10px] font-medium tabular-nums',
            !hasData || !status!.waitTimeSeconds ? 'text-slate-600' : 'text-amber-400',
          )}>
            {!hasData ? '—' : formatWaitTime(status!.waitTimeSeconds)}
          </span>
        </div>
      </div>

      {/* ── Source indicators + audio bar ──────────────────────────────── */}
      <div className="space-y-2">
        {/* Audio level bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Volume2 className="w-3 h-3" />
              <span>Audio</span>
            </div>
            <span className={cn(
              'text-[10px] font-mono tabular-nums',
              !hasData ? 'text-slate-600' :
              (status!.audioDecibels ?? 0) >= 85 ? 'text-red-400' :
              (status!.audioDecibels ?? 0) >= 70 ? 'text-amber-400' : 'text-slate-400',
            )}>
              {!hasData ? '—' : `${Math.round(status!.audioDecibels)} dB`}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                !hasData ? 'bg-slate-700 w-0' :
                decibelColor(status!.audioDecibels),
              )}
              style={{ width: hasData ? `${decibelWidth(status!.audioDecibels)}%` : '0%' }}
            />
          </div>
        </div>

        {/* Data source chips */}
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border',
            hasData
              ? 'bg-cyan-500/8 border-cyan-500/20 text-cyan-500'
              : 'bg-slate-800/50 border-slate-700/50 text-slate-600',
          )}>
            <Brain className="w-2.5 h-2.5" />
            AI {hasData ? `${Math.round((status!.aiConfidence ?? 0) * 100)}%` : '—'}
          </div>
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border',
            hasData && status!.wifiCustomerPresent
              ? 'bg-indigo-500/8 border-indigo-500/20 text-indigo-400'
              : 'bg-slate-800/50 border-slate-700/50 text-slate-600',
          )}>
            <Wifi className="w-2.5 h-2.5" />
            WiFi {hasData ? (status!.wifiCustomerPresent ? 'active' : 'idle') : '—'}
          </div>
          {status?.lastUpdated && (
            <span className="ml-auto text-[9px] text-slate-600 font-mono">
              {new Date(status.lastUpdated).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
