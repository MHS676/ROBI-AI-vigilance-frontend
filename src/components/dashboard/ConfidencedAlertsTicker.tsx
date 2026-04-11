'use client';

/**
 * ConfidencedAlertsTicker
 * ────────────────────────
 * Vertical live ticker for the Enterprise Dashboard.
 *
 * Each entry shows:
 *  • Objective label
 *  • Technology source (📷 CCTV / 📡 WiFi Sees / 🎙️ Audio)
 *  • Confidence score bar
 *  • Center name + relative time
 *  • Severity colour ring
 *
 * Data comes from the `confidencedAlerts` slice of the Zustand alerts store.
 */

import { useRef, useEffect } from 'react';
import { Activity, Trash2 } from 'lucide-react';
import { useAlertsStore } from '@/store/alerts.store';
import type { ConfidencedAlert } from '@/types';
import { cn } from '@/lib/utils';
import { SEVERITY_COLORS, SEVERITY_DOT } from '@/lib/constants';

// ─── Utility ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TECH_LABEL: Record<string, string> = {
  CCTV:       '📷 CCTV AI',
  WIFI:       '📡 WiFi Sees',
  AUDIO:      '🎙️ Audio AI',
  'CCTV+WIFI':  '📷+📡 Hybrid',
  'CCTV+AUDIO': '📷+🎙️ Hybrid',
  ALL:        '📷+📡+🎙️ All',
};

// ─── Single alert card ────────────────────────────────────────────────────────
function AlertCard({ alert }: { alert: ConfidencedAlert }) {
  const dot  = SEVERITY_DOT[alert.severity]    ?? 'bg-slate-400';
  const text = SEVERITY_COLORS[alert.severity] ?? 'text-slate-400 bg-slate-400/10';
  const conf = alert.confidence;

  return (
    <div className={cn(
      'flex flex-col gap-2 p-3 rounded-xl border transition-colors',
      alert.severity === 'CRITICAL' ? 'bg-red-950/30 border-red-500/25' :
      alert.severity === 'HIGH'     ? 'bg-orange-950/20 border-orange-500/20' :
      alert.severity === 'MEDIUM'   ? 'bg-amber-950/20 border-amber-500/15' :
                                      'bg-slate-800/50 border-slate-700/30',
    )}>
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1', dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-white leading-tight truncate">
              {alert.objectiveLabel}
            </span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide', text)}>
              {alert.severity}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{alert.centerName}</p>
        </div>
        <span className="text-[10px] text-slate-600 shrink-0">{relativeTime(alert.serverTime)}</span>
      </div>

      {/* Source + confidence */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 font-medium">
          {TECH_LABEL[alert.tech] ?? alert.tech}
        </span>
        {conf > 0 && (
          <div className="flex items-center gap-2 min-w-[80px]">
            {/* Confidence bar */}
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  conf >= 85 ? 'bg-emerald-400' :
                  conf >= 65 ? 'bg-amber-400' :
                  'bg-red-400',
                )}
                style={{ width: `${Math.min(conf, 100)}%` }}
              />
            </div>
            <span className={cn(
              'text-[10px] font-bold tabular-nums w-7 text-right',
              conf >= 85 ? 'text-emerald-400' :
              conf >= 65 ? 'text-amber-400' :
              'text-red-400',
            )}>
              {conf.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ConfidencedAlertsTicker({ className }: { className?: string }) {
  const confidencedAlerts = useAlertsStore((s) => s.confidencedAlerts);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new alerts arrive
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [confidencedAlerts.length]);

  return (
    <div className={cn('flex flex-col bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
        <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
        <h2 className="text-sm font-semibold text-white flex-1">Live Intelligence Feed</h2>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain">
        {confidencedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Activity className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">No alerts yet</p>
              <p className="text-xs text-slate-700 mt-1">Alerts appear with source + confidence score</p>
            </div>
          </div>
        ) : (
          confidencedAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>

      {/* Footer */}
      {confidencedAlerts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 shrink-0 text-[10px] text-slate-600 text-center">
          {confidencedAlerts.length} event{confidencedAlerts.length !== 1 ? 's' : ''} in session
        </div>
      )}
    </div>
  );
}
