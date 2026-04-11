'use client';

import { useRef, useEffect } from 'react';
import { Trash2, Activity } from 'lucide-react';
import { useAlertsStore, EVENT_META } from '@/store/alerts.store';
import type { AlertItem } from '@/store/alerts.store';
import { SEVERITY_DOT, SEVERITY_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

// ─── Utility: relative time ───────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Single alert row ─────────────────────────────────────────────────────────
function AlertRow({ item }: { item: AlertItem }) {
  const meta = EVENT_META[item.event] ?? { label: item.event, emoji: '📌', isAlert: false };
  const dot  = SEVERITY_DOT[item.severity]    ?? 'bg-slate-400';
  const text = SEVERITY_COLORS[item.severity] ?? 'text-slate-400 bg-slate-400/10';

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors duration-200',
        meta.isAlert ? 'bg-slate-800/60 hover:bg-slate-800' : 'bg-slate-900/60',
        item.severity === 'CRITICAL'
          ? 'border-red-500/30'
          : item.severity === 'HIGH'
          ? 'border-orange-500/20'
          : 'border-slate-700/30',
      )}
    >
      {/* Severity dot */}
      <span
        className={cn('w-2 h-2 rounded-full mt-1 shrink-0', dot)}
        aria-hidden
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Event label + severity badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-white leading-tight">
            {meta.emoji} {meta.label}
          </span>
          <span
            className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
              text,
            )}
          >
            {item.severity}
          </span>
        </div>

        {/* Center name */}
        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {item.centerName}
        </p>

        {/* Extra data (show table / class if present) */}
        {!!(item.data?.tableId || item.data?.class_name || item.data?.anomaly_type) && (
          <p className="text-[10px] text-slate-600 mt-0.5 truncate">
            {[item.data?.tableId, item.data?.class_name ?? item.data?.anomaly_type]
              .filter(Boolean)
              .map(String)
              .join(' · ')}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-[10px] text-slate-600 mt-1">
          {relativeTime(item.serverTime)}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveAlertsFeed() {
  const alerts      = useAlertsStore((s) => s.alerts);
  const unreadCount = useAlertsStore((s) => s.unreadCount);
  const clearAlerts = useAlertsStore((s) => s.clearAlerts);
  const markRead    = useAlertsStore((s) => s.markRead);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new alerts arrive (feed is newest-first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  // Mark as read when panel is visible
  useEffect(() => {
    if (unreadCount > 0) markRead();
  }, [unreadCount, markRead]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
        <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
        <h2 className="text-sm font-semibold text-white flex-1">
          Live Alerts Feed
        </h2>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Live pulse */}
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>

        {/* Clear button */}
        {alerts.length > 0 && (
          <button
            onClick={clearAlerts}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition-all"
            aria-label="Clear feed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Feed ────────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 overscroll-contain"
      >
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Activity className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                No alerts yet
              </p>
              <p className="text-xs text-slate-700 mt-1">
                Events will appear here in real-time
              </p>
            </div>
          </div>
        ) : (
          alerts.map((item) => <AlertRow key={item.id} item={item} />)
        )}
      </div>

      {/* ── Footer count ────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 shrink-0">
          <p className="text-[10px] text-slate-600 text-center">
            {alerts.length} event{alerts.length !== 1 ? 's' : ''} in session
          </p>
        </div>
      )}
    </div>
  );
}
