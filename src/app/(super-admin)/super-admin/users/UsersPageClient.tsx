'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  Shield,
  User2,
} from 'lucide-react';
import { usersApi } from '@/lib/api';
import type { User, Role } from '@/types';
import { cn } from '@/lib/utils';

// ─── Role display metadata ────────────────────────────────────────────────────
const ROLE_META: Record<
  Role,
  {
    label: string;
    color: string;
    bg: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/20',
    Icon: ShieldCheck,
  },
  ADMIN: {
    label: 'Admin',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10 border-cyan-400/20',
    Icon: Shield,
  },
  AGENT: {
    label: 'Agent',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
    Icon: User2,
  },
};

// ─── Role filter tabs ─────────────────────────────────────────────────────────
const ROLE_FILTERS: Array<{ value: Role | 'ALL'; label: string }> = [
  { value: 'ALL',         label: 'All' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN',       label: 'Admin' },
  { value: 'AGENT',       label: 'Agent' },
];

// ─── User row ─────────────────────────────────────────────────────────────────
function UserRow({ user }: { user: User }) {
  const meta = ROLE_META[user.role];
  const Icon = meta.Icon;
  const initials =
    (user.firstName?.[0] ?? '?').toUpperCase() +
    (user.lastName?.[0]  ?? '').toUpperCase();

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
      {/* Avatar + name + email */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-slate-700 border border-slate-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-slate-300">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role badge */}
      <td className="py-3 px-4">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            meta.color,
            meta.bg,
          )}
        >
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </td>

      {/* Center */}
      <td className="py-3 px-4">
        <span className="text-xs text-slate-400 font-mono">
          {user.centerId
            ? <span className="text-slate-300">{user.centerId.slice(0, 8)}…</span>
            : <span className="text-slate-700">—</span>}
        </span>
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            user.isActive ? 'text-emerald-400' : 'text-slate-500',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              user.isActive ? 'bg-emerald-400' : 'bg-slate-600',
            )}
          />
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UsersPageClient() {
  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await usersApi.getAll();
      setUsers(data);
    } catch {
      setError('Failed to load users. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const counts = {
    ALL:         users.length,
    SUPER_ADMIN: users.filter((u) => u.role === 'SUPER_ADMIN').length,
    ADMIN:       users.filter((u) => u.role === 'ADMIN').length,
    AGENT:       users.filter((u) => u.role === 'AGENT').length,
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const matchesRole   = roleFilter === 'ALL' || u.role === roleFilter;
    const q             = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)  ||
      u.email.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full gap-5">

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading ? (
              'Loading users…'
            ) : (
              <>
                Managing{' '}
                <span className="text-cyan-400 font-semibold">{users.length}</span>{' '}
                staff across all Falcon Security centers
              </>
            )}
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full h-9 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Role filter tabs */}
        <div className="flex gap-1">
          {ROLE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
                roleFilter === value
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700',
              )}
            >
              {label}
              {!loading && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {counts[value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          /* Skeleton */
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchUsers}
              className="text-xs text-cyan-400 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
            <Users className="w-8 h-8" />
            <p className="text-sm">No users match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Center ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer count ───────────────────────────────────────────────── */}
      {!loading && !error && (
        <p className="text-xs text-slate-600 shrink-0">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  );
}
