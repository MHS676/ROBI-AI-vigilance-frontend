'use client';

/**
 * AgentProfileClient — Agent 360 Intelligence Profile
 *
 * Live profile page for a single agent showing:
 *   • Top section: face photo, name, center, live/away status
 *   • Metrics grid: attendance, chair time, gossip alerts, SHI%
 *   • SVG bar chart: daily productivity (active minutes vs shift minutes)
 *   • SVG sentiment trend line: rolling SHI % over the last 30 days
 *
 * Real-time updates via three WS events (alerts.store.ts):
 *   agent:profile_updated    → full profile refresh
 *   agent:activity_updated   → patches metrics grid + SHI
 *   agent:attendance_updated → patches attendance row
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  User,
  Clock,
  MessageSquareWarning,
  Smile,
  ArrowLeft,
  Wifi,
  WifiOff,
  Calendar,
  TrendingUp,
  Activity,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { agentApi } from '@/lib/api';
import { useAlertsStore, AGENT_EVENTS } from '@/store/alerts.store';
import { useSocket } from '@/hooks/useSocket';
import type {
  AgentProfile,
  WsEventEnvelope,
  AgentActivityWsPayload,
  AgentAttendanceWsPayload,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

function shiColor(shi: number): string {
  if (shi >= 70) return '#22c55e';  // green-500
  if (shi >= 45) return '#f59e0b';  // amber-500
  return '#ef4444';                 // red-500
}

function shiLabel(shi: number): string {
  if (shi >= 70) return 'Positive';
  if (shi >= 45) return 'Neutral';
  return 'Negative';
}

function pctColor(pct: number): string {
  if (pct >= 70) return '#22c55e';
  if (pct >= 45) return '#f59e0b';
  return '#ef4444';
}

/** Returns initials for avatar fallback */
function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** Format ISO time to HH:MM */
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── MetricCard ────────────────────────────────────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;  // tailwind border-l colour class e.g. "border-green-500"
  pulse?: boolean;  // animate-pulse ring for live updates
}

function MetricCard({ icon, label, value, sub, accent = 'border-slate-600', pulse }: MetricCardProps) {
  return (
    <div className={`relative flex flex-col gap-2 rounded-xl bg-slate-900 border border-slate-800 border-l-4 ${accent} p-4 overflow-hidden`}>
      {pulse && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ── SvgBarChart ───────────────────────────────────────────────────────────────
/** Daily productivity bar chart — renders entirely with SVG, no library needed */
interface SvgBarChartProps {
  history: AgentProfile['recentHistory'];
}

const BAR_W = 28;
const BAR_GAP = 8;
const CHART_H = 120;
const CHART_PADDING_TOP = 16;

function SvgBarChart({ history }: SvgBarChartProps) {
  // Show last 14 days — enough to see a week-over-week pattern
  const data = useMemo(() => [...history].reverse().slice(0, 14), [history]);

  const maxMinutes = useMemo(
    () => Math.max(...data.map((d) => d.activeMinutes), 60),
    [data],
  );

  const totalW = data.length * (BAR_W + BAR_GAP) - BAR_GAP + 24;

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={CHART_H + 40}
        className="min-w-full"
        aria-label="Daily productivity bar chart"
      >
        {/* Y-axis gridlines */}
        {[0, 0.5, 1].map((pct) => {
          const y = CHART_PADDING_TOP + (1 - pct) * CHART_H;
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={totalW} y2={y} stroke="#1e293b" strokeWidth={1} />
              <text x={0} y={y - 2} fontSize={9} fill="#475569">
                {Math.round(pct * maxMinutes)}m
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((day, i) => {
          const barH = Math.max(2, (day.activeMinutes / maxMinutes) * CHART_H);
          const x = 12 + i * (BAR_W + BAR_GAP);
          const y = CHART_PADDING_TOP + (CHART_H - barH);
          const color = day.gossipCount > 0 ? '#f59e0b' : '#6366f1';
          const labelDate = new Date(day.date);
          const label = labelDate.toLocaleDateString([], { weekday: 'short' }).slice(0, 3);

          return (
            <g key={day.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                rx={4}
                fill={color}
                opacity={0.85}
              />
              {/* SHI dot on top of bar */}
              <circle
                cx={x + BAR_W / 2}
                cy={y - 5}
                r={3}
                fill={shiColor(day.shi)}
              />
              {/* Day label */}
              <text
                x={x + BAR_W / 2}
                y={CHART_PADDING_TOP + CHART_H + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
              >
                {label}
              </text>
              {/* Active minutes label */}
              <text
                x={x + BAR_W / 2}
                y={CHART_PADDING_TOP + CHART_H + 24}
                textAnchor="middle"
                fontSize={8}
                fill="#475569"
              >
                {Math.round(day.activeMinutes)}m
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-indigo-500" />
          Active minutes
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-amber-500" />
          Gossip flagged day
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          SHI indicator
        </span>
      </div>
    </div>
  );
}

// ── SvgSentimentLine ──────────────────────────────────────────────────────────
/** Rolling SHI% trend line — rendered with SVG path, no library */
interface SvgSentimentLineProps {
  history: AgentProfile['recentHistory'];
}

const LINE_W = 520;
const LINE_H = 100;
const LINE_PAD = { top: 12, right: 12, bottom: 28, left: 32 };

function SvgSentimentLine({ history }: SvgSentimentLineProps) {
  const data = useMemo(() => [...history].reverse(), [history]);

  const innerW = LINE_W - LINE_PAD.left - LINE_PAD.right;
  const innerH = LINE_H - LINE_PAD.top - LINE_PAD.bottom;

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: LINE_PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
        y: LINE_PAD.top + (1 - d.shi / 100) * innerH,
        shi: d.shi,
        date: d.date,
      })),
    [data, innerW, innerH],
  );

  const pathD = points.length < 2
    ? ''
    : points.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        // Smooth cubic bezier
        const prev = points[i - 1];
        const cpX = (prev.x + p.x) / 2;
        return `${acc} C ${cpX} ${prev.y} ${cpX} ${p.y} ${p.x} ${p.y}`;
      }, '');

  // Fill gradient path
  const fillD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${LINE_PAD.top + innerH} L ${points[0].x} ${LINE_PAD.top + innerH} Z`
    : '';

  const yLabels = [0, 25, 50, 75, 100];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${LINE_W} ${LINE_H}`}
        width="100%"
        height={LINE_H + 8}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Sentiment trend line chart"
      >
        <defs>
          <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
          {/* Danger zone fill below 50 */}
          <linearGradient id="sentimentDanger" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {yLabels.map((val) => {
          const y = LINE_PAD.top + (1 - val / 100) * innerH;
          return (
            <g key={val}>
              <line
                x1={LINE_PAD.left}
                y1={y}
                x2={LINE_W - LINE_PAD.right}
                y2={y}
                stroke={val === 50 ? '#374151' : '#1e293b'}
                strokeWidth={val === 50 ? 1.5 : 1}
                strokeDasharray={val === 50 ? '4 4' : undefined}
              />
              <text x={LINE_PAD.left - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#475569">
                {val}
              </text>
            </g>
          );
        })}

        {/* Fill */}
        {fillD && <path d={fillD} fill="url(#sentimentGrad)" />}

        {/* Line */}
        {pathD && (
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={shiColor(p.shi)}
            stroke="#0f172a"
            strokeWidth={1}
          />
        ))}

        {/* X axis date labels — only show every 5th */}
        {points.map((p, i) => {
          if (i % 5 !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={LINE_H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="#475569"
            >
              {new Date(data[i].date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── TimeInChairBar ─────────────────────────────────────────────────────────────
function TimeInChairBar({ pct }: { pct: number }) {
  const color = pctColor(pct);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Chair time today</span>
        <span style={{ color }} className="font-semibold">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── LiveStatusBadge ───────────────────────────────────────────────────────────
function LiveStatusBadge({ isLive }: { isLive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isLive
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-700/50 text-slate-400 border border-slate-700'
      }`}
    >
      {isLive ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Live
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          Away
        </>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function AgentProfileClient() {
  const params = useParams();
  const router = useRouter();
  const agentId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  // ── Store selectors ──────────────────────────────────────────────────────────
  const cachedProfile    = useAlertsStore((s) => s.agentProfiles[agentId]);
  const updateAgentProfile    = useAlertsStore((s) => s.updateAgentProfile);
  const patchAgentActivity    = useAlertsStore((s) => s.patchAgentActivity);
  const patchAgentAttendance  = useAlertsStore((s) => s.patchAgentAttendance);

  // ── Local state ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<AgentProfile | null>(cachedProfile ?? null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [flashMetric, setFlashMetric] = useState<string | null>(null);

  // ── Socket ────────────────────────────────────────────────────────────────────
  const { on } = useSocket();

  // ── Initial fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    agentApi.getProfile(agentId)
      .then((res) => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? 'Failed to load agent profile');
        setLoading(false);
      });
  }, [agentId]);

  // ── Keep local state in sync with cached store state ──────────────────────────
  useEffect(() => {
    if (cachedProfile) {
      setProfile(cachedProfile);
      setLastUpdate(new Date());
    }
  }, [cachedProfile]);

  // ── Flash helper ─────────────────────────────────────────────────────────────
  const flash = useCallback((key: string) => {
    setFlashMetric(key);
    setTimeout(() => setFlashMetric(null), 1200);
  }, []);

  // ── Real-time WS subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const offProfile = on<WsEventEnvelope>('agent:profile_updated', (envelope) => {
      updateAgentProfile(envelope);
      setLastUpdate(new Date());
      flash('profile');
    });

    const offActivity = on<WsEventEnvelope<AgentActivityWsPayload>>('agent:activity_updated', (envelope) => {
      if (envelope.data?.agentId !== agentId) return;
      patchAgentActivity(envelope);
      flash('activity');
    });

    const offAttendance = on<WsEventEnvelope<AgentAttendanceWsPayload>>('agent:attendance_updated', (envelope) => {
      if (envelope.data?.agentId !== agentId) return;
      patchAgentAttendance(envelope);
      flash('attendance');
    });

    return () => {
      offProfile();
      offActivity();
      offAttendance();
    };
  }, [agentId, on, updateAgentProfile, patchAgentActivity, patchAgentAttendance, flash]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const isLive = useMemo(() => {
    if (!profile?.todayAttendance) return false;
    const { entryTime, exitTime } = profile.todayAttendance;
    if (!entryTime || exitTime) return false;
    // Consider live if punched in today and not yet punched out
    return true;
  }, [profile]);

  const shiValue = profile?.todayActivity?.shi ?? profile?.lifetimeTotals?.avgShi ?? 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-slate-800 rounded-lg" />
        <div className="h-48 bg-slate-800/50 rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-56 bg-slate-800/40 rounded-xl" />
          <div className="h-56 bg-slate-800/40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="text-slate-300 font-medium">{error ?? 'Profile not found'}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  const tic = profile.timeInChair;
  const activity = profile.todayActivity;
  const attendance = profile.todayAttendance;
  const lifetime = profile.lifetimeTotals;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">

      {/* ── Breadcrumb / Back ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Agents
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">{profile.firstName} {profile.lastName}</span>
        </button>
        {lastUpdate && (
          <span className="text-xs text-slate-600">
            Last update: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          TOP SECTION — Agent identity card
          ───────────────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/5 via-transparent to-transparent pointer-events-none" />

        {/* Avatar */}
        <div className="relative shrink-0">
          {profile.facePhotoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/face-photo?path=${encodeURIComponent(profile.facePhotoPath)}`}
              alt={`${profile.firstName} ${profile.lastName}`}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-400">
                {initials(profile.firstName, profile.lastName)}
              </span>
            </div>
          )}
          {/* Live pulse ring */}
          {isLive && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900" />
            </span>
          )}
        </div>

        {/* Identity info */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">
              {profile.firstName} {profile.lastName}
            </h1>
            <LiveStatusBadge isLive={isLive} />
          </div>

          <p className="text-sm text-slate-400 truncate">{profile.email}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            {profile.centerName && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {profile.centerName}
              </span>
            )}
            {profile.assignedTableName && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                {profile.assignedTableName}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/50">
              {profile.role}
            </span>
          </div>
        </div>

        {/* SHI gauge */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="40" cy="40" r="32"
                fill="none"
                stroke={shiColor(shiValue)}
                strokeWidth="8"
                strokeDasharray={`${(shiValue / 100) * 201.1} 201.1`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
              <span className="text-lg font-bold text-white leading-none">{Math.round(shiValue)}</span>
              <span className="text-[10px] text-slate-400">SHI%</span>
            </div>
          </div>
          <span className="text-xs" style={{ color: shiColor(shiValue) }}>{shiLabel(shiValue)}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          METRICS GRID — 4 key stat cards
          ───────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* 1 — Attendance Today */}
        <MetricCard
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Attendance Today"
          value={attendance ? fmtTime(attendance.entryTime) : 'No punch-in'}
          sub={
            attendance
              ? attendance.exitTime
                ? `Out ${fmtTime(attendance.exitTime)} · ${fmtMinutes(attendance.totalShiftMinutes)}`
                : 'Currently on shift'
              : undefined
          }
          accent={attendance ? 'border-emerald-500' : 'border-slate-600'}
          pulse={flashMetric === 'attendance' || flashMetric === 'profile'}
        />

        {/* 2 — Total Chair Time */}
        <MetricCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Chair Time Today"
          value={fmtMinutes(tic?.activeMinutes ?? activity?.activeMinutes)}
          sub={
            tic
              ? `${tic.timeInChairPct.toFixed(1)}% of ${fmtMinutes(tic.totalShiftMinutes)} shift`
              : `Lifetime avg ${lifetime.avgTimeInChairPct}%`
          }
          accent="border-indigo-500"
          pulse={flashMetric === 'activity' || flashMetric === 'profile'}
        />

        {/* 3 — Gossip Alerts */}
        <MetricCard
          icon={<MessageSquareWarning className="w-3.5 h-3.5" />}
          label="Gossip Alerts"
          value={String(activity?.gossipCount ?? 0)}
          sub={`Lifetime total: ${lifetime.totalGossipCount}`}
          accent={
            (activity?.gossipCount ?? 0) > 0
              ? 'border-amber-500'
              : 'border-slate-600'
          }
          pulse={flashMetric === 'activity'}
        />

        {/* 4 — Expression Score */}
        <MetricCard
          icon={<Smile className="w-3.5 h-3.5" />}
          label="Expression Score"
          value={`${Math.round(activity?.shi ?? lifetime.avgShi ?? 50)}%`}
          sub={`Lifetime avg SHI: ${lifetime.avgShi}%`}
          accent={
            (activity?.shi ?? 0) >= 70
              ? 'border-green-500'
              : (activity?.shi ?? 0) >= 45
              ? 'border-amber-500'
              : 'border-red-500'
          }
          pulse={flashMetric === 'activity' || flashMetric === 'profile'}
        />
      </div>

      {/* Chair time progress bar */}
      {tic && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <TimeInChairBar pct={tic.timeInChairPct} />
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-slate-500">
            <span>
              <span className="text-slate-300 font-medium">{fmtMinutes(tic.activeMinutes)}</span> active
            </span>
            <span>
              <span className="text-slate-300 font-medium">{fmtMinutes(tic.idleMinutes)}</span> idle
            </span>
            <span>
              <span className="text-amber-400 font-medium">{fmtMinutes(tic.alertDrivenIdleMinutes)}</span> idle from alerts
            </span>
            <span>
              <span className="text-slate-300 font-medium">{fmtMinutes(tic.totalShiftMinutes)}</span> total shift
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          VISUALS — bar chart + sentiment trend
          ───────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Daily Productivity Bar Chart */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Daily Productivity</h3>
            <span className="ml-auto text-xs text-slate-500">Last 14 days</span>
          </div>
          {profile.recentHistory.length > 0 ? (
            <SvgBarChart history={profile.recentHistory} />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              No history yet
            </div>
          )}
        </div>

        {/* Sentiment Trend Line */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Expression Score Trend</h3>
            <span className="ml-auto text-xs text-slate-500">30-day SHI%</span>
          </div>
          {profile.recentHistory.length > 1 ? (
            <SvgSentimentLine history={profile.recentHistory} />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              Insufficient data
            </div>
          )}
          {/* Current SHI callout */}
          {activity && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
              <span>Today's SHI</span>
              <span className="font-semibold text-base" style={{ color: shiColor(activity.shi) }}>
                {Math.round(activity.shi)}%
                <span className="text-slate-500 font-normal text-xs ml-1">({shiLabel(activity.shi)})</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          LIFETIME STATS — compact summary row
          ───────────────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Lifetime Performance</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {[
            { label: 'Total Shifts',     value: String(lifetime.totalShifts) },
            { label: 'Active Hours',     value: fmtMinutes(lifetime.totalActiveMinutes) },
            { label: 'Total Gossips',    value: String(lifetime.totalGossipCount) },
            { label: 'Avg SHI',          value: `${lifetime.avgShi}%` },
            { label: 'Avg Chair Time',   value: `${lifetime.avgTimeInChairPct}%` },
            { label: 'Avg Sentiment',    value: lifetime.avgSentimentScore.toFixed(2) },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <span className="text-lg font-bold text-white">{stat.value}</span>
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
