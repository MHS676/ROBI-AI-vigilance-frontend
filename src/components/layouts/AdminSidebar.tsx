'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Camera,
  Cpu,
  Mic,
  Activity,
  ShieldCheck,
  Building2,
  Table2,
  Map,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { centersApi } from '@/lib/api';
import type { Center } from '@/types';

const NAV_ITEMS = [
  { href: '/admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/cameras',     icon: Camera,          label: 'Cameras' },
  { href: '/admin/esp-nodes',   icon: Cpu,             label: 'ESP Nodes' },
  { href: '/admin/microphones', icon: Mic,             label: 'Microphones' },
  { href: '/admin/tables',      icon: Table2,          label: 'Tables' },
  { href: '/admin/mapping',     icon: Map,             label: 'Mapping' },
  { href: '/admin/live',        icon: Activity,        label: 'Live Events' },
  { href: '/admin/recordings',  icon: HardDrive,       label: 'Recordings' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user }  = useAuth();
  const [center, setCenter] = useState<Center | null>(null);

  // Fetch the current admin's center info
  useEffect(() => {
    if (user?.centerId) {
      centersApi
        .getOne(user.centerId)
        .then(({ data }) => setCenter(data))
        .catch(console.error);
    }
  }, [user?.centerId]);

  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="h-16 border-b border-slate-800 flex items-center gap-3 px-4 shrink-0">
        <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Falcon</p>
          <p className="text-[10px] text-indigo-400 mt-0.5 font-medium tracking-wide uppercase">
            Center Admin
          </p>
        </div>
      </div>

      {/* ── Center info banner ────────────────────────────────────────────── */}
      <div className="mx-3 mt-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              Your Center
            </p>
            {center ? (
              <>
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {center.name}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {center.code}
                </p>
              </>
            ) : (
              <div className="h-4 w-28 bg-slate-700 rounded animate-pulse mt-0.5" />
            )}
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
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

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <p className="text-xs text-slate-600 px-1">
          Signed in as{' '}
          <span className="text-slate-400">
            {user?.firstName} {user?.lastName}
          </span>
        </p>
      </div>
    </aside>
  );
}
