'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Camera,
  Cpu,
  Mic,
  Activity,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Search,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { centersApi } from '@/lib/api';
import type { Center } from '@/types';

// ─── Top-level nav items for SUPER_ADMIN ─────────────────────────────────────
const NAV_ITEMS = [
  { href: '/super-admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/super-admin/centers',     icon: Building2,       label: 'All Centers' },
  { href: '/super-admin/users',       icon: Users,           label: 'Users' },
  { href: '/super-admin/cameras',     icon: Camera,          label: 'Cameras' },
  { href: '/super-admin/esp-nodes',   icon: Cpu,             label: 'ESP Nodes' },
  { href: '/super-admin/microphones', icon: Mic,             label: 'Microphones' },
  { href: '/super-admin/mapping',     icon: Map,             label: 'Mapping' },
  { href: '/super-admin/live',        icon: Activity,        label: 'Live Events' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [centers, setCenters]         = useState<Center[]>([]);
  const [centersOpen, setCentersOpen] = useState(true);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    centersApi
      .getAll({ isActive: undefined })
      .then(({ data }) => setCenters(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = centers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="h-16 border-b border-slate-800 flex items-center gap-3 px-4 shrink-0">
        <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center shadow-inner">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Falcon</p>
          <p className="text-[10px] text-cyan-400 mt-0.5 font-medium tracking-wide uppercase">
            Super Admin
          </p>
        </div>
      </div>

      {/* ── Main navigation ──────────────────────────────────────────────── */}
      <nav className="px-3 pt-3 space-y-0.5 shrink-0">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'sidebar-item',
              (pathname === href || pathname.startsWith(`${href}/`)) &&
                'sidebar-item-active',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="mx-4 mt-3 mb-1 border-t border-slate-800 shrink-0" />

      {/* ── Centers list (collapsible, searchable, scrollable) ───────────── */}
      <div className="flex flex-col flex-1 min-h-0 px-3 pb-3">
        {/* Section header */}
        <button
          onClick={() => setCentersOpen((v) => !v)}
          className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors shrink-0"
        >
          <span>Centers ({centers.length})</span>
          {centersOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {centersOpen && (
          <>
            {/* Search box */}
            <div className="relative mt-1 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search centers…"
                className="w-full h-8 pl-8 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto mt-1.5 space-y-0.5">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 bg-slate-800/60 rounded-lg animate-pulse"
                    />
                  ))
                : filtered.length === 0
                ? (
                    <p className="text-xs text-slate-600 text-center py-6">
                      No centers found
                    </p>
                  )
                : filtered.map((center) => {
                    const href    = `/super-admin/centers/${center.id}`;
                    const isActive = pathname.startsWith(href);
                    return (
                      <Link
                        key={center.id}
                        href={href}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 group',
                          isActive
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              center.isActive
                                ? 'bg-emerald-400'
                                : 'bg-slate-600',
                            )}
                          />
                          <span className="truncate font-medium">
                            {center.name}
                          </span>
                        </div>
                        <span className="text-slate-600 group-hover:text-slate-500 shrink-0 ml-1 font-mono text-[10px]">
                          {center.code}
                        </span>
                      </Link>
                    );
                  })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
