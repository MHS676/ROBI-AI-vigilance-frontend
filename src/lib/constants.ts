import type { Role } from '@/types';

// ─── Cookie / storage keys ────────────────────────────────────────────────────
export const TOKEN_COOKIE_KEY = 'falcon_access_token' as const;

// ─── Role routing ─────────────────────────────────────────────────────────────
export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  ADMIN: '/admin/dashboard',
  AGENT: '/admin/dashboard',
} as const;

// ─── Display labels ───────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN: 'Center Administrator',
  AGENT: 'Field Agent',
} as const;

// ─── Tailwind color maps ──────────────────────────────────────────────────────
export const DEVICE_STATUS_COLORS = {
  ONLINE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  OFFLINE: 'text-red-400 bg-red-400/10 border-red-400/20',
  MAINTENANCE: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
} as const;

export const SEVERITY_COLORS = {
  INFO:     'text-slate-400 bg-slate-400/10',
  LOW:      'text-sky-400 bg-sky-400/10',
  MEDIUM:   'text-amber-400 bg-amber-400/10',
  HIGH:     'text-orange-400 bg-orange-400/10',
  CRITICAL: 'text-red-400 bg-red-400/10 animate-pulse',
} as const;

export const SEVERITY_DOT: Record<string, string> = {
  INFO:     'bg-slate-400',
  LOW:      'bg-sky-400',
  MEDIUM:   'bg-amber-400 animate-pulse',
  HIGH:     'bg-orange-400 animate-pulse',
  CRITICAL: 'bg-red-400 animate-pulse shadow-[0_0_8px_#f87171]',
};

export const SEVERITY_BORDER: Record<string, string> = {
  INFO:     'border-slate-700/50',
  LOW:      'border-sky-500/20',
  MEDIUM:   'border-amber-500/20',
  HIGH:     'border-orange-500/30',
  CRITICAL: 'border-red-500/40',
};
